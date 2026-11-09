import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { canSendOn } from "@/features/receivables/mail-schedule";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailErrorCode } from "@/features/sms-sender/mail-error-code";
import { parseAdminEmails } from "@/features/manual-ledger/admins";
import { loadOperatorDirectory } from "@/features/manual-ledger/operators";
import { ManualSourceError } from "@/features/manual-ledger/parse";
import { resolveLedger } from "@/features/manual-ledger/resolve";
import {
  MANUAL_SOURCE_ENV,
  fetchManualSource,
} from "@/features/manual-ledger/source";
import { reviewHalfFor, type ReviewHalf } from "@/features/manual-review/half";
import {
  buildReviewMail,
  buildSummaryMail,
  type ReviewSummary,
} from "@/features/manual-review/mail";
import {
  buildReviewPlan,
  type ReviewPlan,
} from "@/features/manual-review/plan";
import {
  loadSentKeys,
  saveReminder,
  summaryKey,
  type ReminderStatus,
} from "@/features/manual-review/store";
import type { AutomationRunResult } from "../types";

const ADMIN_ENV = "MANUAL_EDIT_ADMIN_EMAILS";
const NO_HOLIDAY_FEED =
  "공휴일 정보를 못 읽어 오늘은 보내지 않았습니다 — 내일 다시 시도";
const RUN_FAILED = "매뉴얼 점검 안내 처리 중 오류가 발생했습니다.";

type Config = { admins: string[]; dryRun: boolean };
type Mail = { subject: string; html: string };
type Outcome = {
  status: ReminderStatus;
  messageId: string | null;
  error: string | null;
};
type Tally = {
  sent: number;
  failed: number;
  dryRun: number;
  skipped: number;
  codes: string[];
};
const NO_TALLY: Tally = {
  sent: 0,
  failed: 0,
  dryRun: 0,
  skipped: 0,
  codes: [],
};

// 형식이 틀린 값이 섞이면(null) 빠진 것과 같이 실패로 끝낸다 — 조용히 한 명을 빼지 않는다.
function adminProblems(admins: string[] | null): string[] {
  if (admins === null) return [`${ADMIN_ENV}(형식 오류)`];
  return admins.length === 0 ? [ADMIN_ENV] : [];
}

function readConfig(): { config: Config } | { missing: string[] } {
  const admins = parseAdminEmails(process.env[ADMIN_ENV]);
  const missing = [
    ...MANUAL_SOURCE_ENV.filter((n) => !process.env[n]),
    ...adminProblems(admins),
  ];
  if (missing.length > 0 || admins === null) return { missing };
  const dryRun = (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true";
  return { config: { admins, dryRun } };
}

/** 받는 사람 본인 메일함에서 본인에게(service-notice 와 같은 방식). */
async function deliver(
  to: string,
  mail: Mail,
  dryRun: boolean,
): Promise<Outcome> {
  if (dryRun) return { status: "dry_run", messageId: null, error: null };
  const res = await sendGraphMail({ senderUserId: to, toEmail: to, ...mail });
  if (res.ok)
    return { status: "sent", messageId: res.messageId ?? null, error: null };
  return { status: "failed", messageId: null, error: mailErrorCode(res.error) };
}

const count = (t: Tally, o: Outcome): Tally => ({
  ...t,
  sent: t.sent + (o.status === "sent" ? 1 : 0),
  dryRun: t.dryRun + (o.status === "dry_run" ? 1 : 0),
  failed: t.failed + (o.status === "failed" ? 1 : 0),
  codes: o.error ? [...t.codes, o.error] : t.codes,
});

type Ctx = {
  db: SupabaseClient;
  half: ReviewHalf;
  sentKeys: Set<string>;
  dryRun: boolean;
};

/**
 * 보내고 곧바로 한 건씩 남긴다. 저장이 실패하면 던져서 멈춘다 — 기록 없이 계속 보내면
 * 다음 호출이 그 사람들을 '안 보낸 사람' 으로 보고 한 번 더 보낸다.
 */
async function sendAndRecord(
  ctx: Ctx,
  key: string,
  to: string,
  mail: Mail,
  manualCount: number,
): Promise<Outcome> {
  const outcome = await deliver(to, mail, ctx.dryRun);
  await saveReminder(ctx.db, {
    half_key: ctx.half.key,
    recipient_key: key,
    status: outcome.status,
    manual_count: manualCount,
    message_id: outcome.messageId,
    error: outcome.error,
  });
  return outcome;
}

async function deliverReminders(ctx: Ctx, plan: ReviewPlan): Promise<Tally> {
  let tally = NO_TALLY;
  for (const r of plan.recipients) {
    if (ctx.sentKeys.has(r.key)) {
      tally = { ...tally, skipped: tally.skipped + 1 };
      continue;
    }
    const mail = buildReviewMail(r, ctx.half);
    tally = count(
      tally,
      await sendAndRecord(ctx, r.key, r.email, mail, r.items.length),
    );
  }
  return tally;
}

/** 관리자 요약 — 반기마다 관리자 한 명에 한 번(`__summary__:` 키). 실패한 관리자만 다음 호출에 다시. */
async function deliverSummaries(
  ctx: Ctx,
  admins: string[],
  summary: ReviewSummary,
): Promise<Tally> {
  const mail = buildSummaryMail(summary, ctx.half);
  let tally = NO_TALLY;
  for (const admin of admins) {
    const key = summaryKey(admin);
    if (ctx.sentKeys.has(key)) continue;
    tally = count(
      tally,
      await sendAndRecord(ctx, key, admin, mail, summary.manualCount),
    );
  }
  return tally;
}

function toSummary(plan: ReviewPlan, rem: Tally): ReviewSummary {
  return {
    recipients: plan.recipients.length,
    notified: rem.skipped + rem.sent + rem.dryRun,
    pending: rem.failed,
    manualCount: plan.manualCount,
    unresolvedOwners: plan.unresolvedOwners,
    unlinked: plan.unlinked,
    missingTasks: plan.missingTasks,
    untasked: plan.untasked,
  };
}

function summarize(
  half: ReviewHalf,
  plan: ReviewPlan,
  rem: Tally,
  sum: Tally,
  dryRun: boolean,
): AutomationRunResult {
  const codes = [...new Set([...rem.codes, ...sum.codes])];
  const failedNote = codes.length > 0 ? ` (${codes.join(", ")})` : "";
  const message =
    `${dryRun ? "[DRY-RUN] " : ""}${half.label} 담당자 ${plan.recipients.length}명 — ` +
    `보냄 ${rem.sent + rem.dryRun} / 실패 ${rem.failed}${failedNote} / 이미 보냄 ${rem.skipped}` +
    ` · 관리자 요약 ${sum.sent + sum.dryRun}${sum.failed > 0 ? ` (실패 ${sum.failed})` : ""}` +
    ` · 담당자 미확인 ${plan.unresolvedOwners.length}건 · 연결 안 됨 ${plan.unlinked.length}건` +
    ` · 대장에 없는 진행 업무 ${plan.missingTasks.length}건 · 업무 칸 빈 문서 ${plan.untasked.length}건`;
  return {
    ok: rem.failed + sum.failed === 0,
    message,
    details: {
      recipients: plan.recipients.length,
      sent: rem.sent,
      failed: rem.failed,
      dryRun: rem.dryRun,
      skipped: rem.skipped,
      manuals: plan.manualCount,
      unresolved: plan.unresolvedOwners.length,
      unlinked: plan.unlinked.length,
      missingTasks: plan.missingTasks.length,
      untasked: plan.untasked.length,
      summarySent: sum.sent + sum.dryRun,
      summaryFailed: sum.failed,
    },
  };
}

async function runForHalf(
  config: Config,
  half: ReviewHalf,
): Promise<AutomationRunResult> {
  const db = createAdminClient();
  const [source, operators] = await Promise.all([
    fetchManualSource(),
    loadOperatorDirectory(db),
  ]);
  const plan = buildReviewPlan(
    resolveLedger(source, operators),
    source.activeTasks,
  );
  const ctx: Ctx = {
    db,
    half,
    sentKeys: await loadSentKeys(db, half.key),
    dryRun: config.dryRun,
  };
  const rem = await deliverReminders(ctx, plan);
  const sum = await deliverSummaries(ctx, config.admins, toSummary(plan, rem));
  return summarize(half, plan, rem, sum, config.dryRun);
}

/**
 * AutomationJob.run — 매뉴얼 반기 점검 알림.
 *
 * cron-job.org 가 매일 10:00 부른다. 반기 cron 두 번은 monthly 미실행 임계(840h)에
 * 걸려 일일 보고가 오탐하므로, 매일 불리고 3월·8월 영업일이 아니면 `skipped` 로 끝난다.
 * 그 달 영업일마다 대장을 다시 읽어 그 반기에 `sent` 가 없는 사람에게만 보낸다 —
 * 첫날 실패한 사람과 달 중간에 대장에 들어온 담당자가 여기서 받는다.
 * 실행 메시지·details 에는 건수만 싣는다.
 */
export async function runManualReviewReminder(
  now: Date = new Date(),
): Promise<AutomationRunResult> {
  const cfg = readConfig();
  if ("missing" in cfg) {
    return { ok: false, message: `환경변수 없음: ${cfg.missing.join(", ")}` };
  }
  const half = reviewHalfFor(now);
  if (!half) {
    return { ok: true, skipped: true, message: "3월·8월이 아님 — 발송 안 함" };
  }
  const holidays = await fetchKoreanHolidays();
  if (holidays.length === 0) {
    // 피드가 비면 대체공휴일(3월 1일이 주말인 해의 3월 2일 등)을 가려낼 수 없다.
    // 주말은 피드 없이도 알 수 있으니 스킵, 평일이면 실패로 남겨 일일 보고가 드러내게 한다
    // (skipped 는 보고에 안 걸려 피드가 계속 비면 반기 알림이 통째로 안 나간다).
    if (!canSendOn(now, [])) {
      return { ok: true, skipped: true, message: "주말·공휴일 — 발송 안 함" };
    }
    return { ok: false, message: NO_HOLIDAY_FEED };
  }
  if (!canSendOn(now, holidays)) {
    return { ok: true, skipped: true, message: "주말·공휴일 — 발송 안 함" };
  }
  try {
    return await runForHalf(cfg.config, half);
  } catch (e) {
    if (e instanceof ManualSourceError)
      return { ok: false, message: e.message };
    console.error("[manual-review-reminder] run error:", e);
    return { ok: false, message: RUN_FAILED };
  }
}
