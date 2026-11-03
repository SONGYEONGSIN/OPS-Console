import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import {
  RequestListError,
  fetchRequestItems,
} from "@/features/sms-sender/request-notify/list-source";
import { buildRequestMail } from "@/features/sms-sender/request-notify/mail";
import {
  reconcile,
  seedRows,
} from "@/features/sms-sender/request-notify/reconcile";
import {
  applyRecoveries,
  claimNotice,
  finishNotice,
  insertNoticeRows,
  loadNoticeRows,
  updateLastStatus,
} from "@/features/sms-sender/request-notify/store";
import {
  MAX_ATTEMPTS,
  type DueNotice,
} from "@/features/sms-sender/request-notify/types";
import type { AutomationRunResult } from "../types";

const ENV_NAMES = [
  "SHAREPOINT_SMS_REQUEST_SITE_ID",
  "SHAREPOINT_SMS_REQUEST_LIST_ID",
  "SMS_SENDER_REQUEST_MANAGER_EMAIL",
] as const;

const LIST_FAILED = "SMS 신청 목록을 읽지 못했습니다.";
const DB_FAILED = "SMS 신청 알림 기록 처리 중 오류가 발생했습니다.";

type Config = {
  siteId: string;
  listId: string;
  manager: string;
  dryRun: boolean;
};
type Outcome =
  | { kind: "newSent" | "doneSent" | "skipped" }
  | { kind: "failed"; code: string };
type FetchedItems = { data: Awaited<ReturnType<typeof fetchRequestItems>> };
type Tally = {
  newSent: number;
  doneSent: number;
  failed: number;
  codes: string[];
};

const NO_APPLICANT_CODE = "신청자 메일 없음";
const CLAIM_LOST_CODE = "claim_lost";
const UNKNOWN_CODE = "send_failed";

// sendGraphMail 의 error 는 `코드: 응답본문` 형식 — 본문(주소가 섞일 수 있다)은 버리고 코드만 쓴다.
function errorCode(error: string): string {
  const m = /^([a-z][a-z0-9_]{0,31}):/.exec(error);
  return m ? m[1] : UNKNOWN_CODE;
}

function readConfig(): { config: Config } | { missing: string[] } {
  const missing = ENV_NAMES.filter((n) => !process.env[n]);
  if (missing.length > 0) return { missing };
  return {
    config: {
      siteId: process.env.SHAREPOINT_SMS_REQUEST_SITE_ID ?? "",
      listId: process.env.SHAREPOINT_SMS_REQUEST_LIST_ID ?? "",
      manager: process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL ?? "",
      dryRun: (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true",
    },
  };
}

async function fetchItems(
  config: Config,
): Promise<FetchedItems | { error: string }> {
  try {
    return { data: await fetchRequestItems(config.siteId, config.listId) };
  } catch (e) {
    if (e instanceof RequestListError) return { error: e.message };
    console.error("[sms-request-notify] list fetch error:", e);
    return { error: LIST_FAILED };
  }
}

function successOutcome(kind: DueNotice["kind"]): Outcome {
  return { kind: kind === "new" ? "newSent" : "doneSent" };
}

function failed(id: string, code: string): Outcome {
  console.error(`[sms-request-notify] item ${id} failed: ${code}`);
  return { kind: "failed", code };
}

async function deliver(
  db: SupabaseClient,
  due: DueNotice,
  config: Config,
  now: Date,
): Promise<Outcome> {
  const id = due.item.id;
  if (due.kind === "done" && due.item.applicantEmail === null) {
    if (!(await claimNotice(db, id, due.kind, due.attempts, now)))
      return { kind: "skipped" };
    await finishNotice(db, id, due.kind, {
      state: "failed",
      error: NO_APPLICANT_CODE,
      now,
    });
    return failed(id, NO_APPLICANT_CODE);
  }
  if (!(await claimNotice(db, id, due.kind, due.attempts, now)))
    return { kind: "skipped" };
  if (config.dryRun) {
    const ok = await finishNotice(db, id, due.kind, { state: "dry_run", now });
    return ok ? successOutcome(due.kind) : failed(id, CLAIM_LOST_CODE);
  }
  const { subject, html } = buildRequestMail(due.kind, due.item);
  const toEmail =
    due.kind === "new" ? config.manager : (due.item.applicantEmail ?? "");
  const res = await sendGraphMail({
    senderUserId: config.manager,
    toEmail,
    subject,
    html,
  });
  if (res.ok) {
    const ok = await finishNotice(db, id, due.kind, {
      state: "sent",
      messageId: res.messageId,
      now,
    });
    return ok ? successOutcome(due.kind) : failed(id, CLAIM_LOST_CODE);
  }
  const code = errorCode(res.error);
  const state = due.attempts + 1 >= MAX_ATTEMPTS ? "failed" : "pending";
  await finishNotice(db, id, due.kind, { state, error: code, now });
  return failed(id, code);
}

async function deliverAll(
  db: SupabaseClient,
  dues: DueNotice[],
  config: Config,
  now: Date,
): Promise<Tally> {
  let tally: Tally = { newSent: 0, doneSent: 0, failed: 0, codes: [] };
  for (const due of dues) {
    const outcome = await deliver(db, due, config, now);
    if (outcome.kind === "skipped") continue;
    if (outcome.kind === "failed") {
      const codes = tally.codes.includes(outcome.code)
        ? tally.codes
        : [...tally.codes, outcome.code];
      tally = { ...tally, failed: tally.failed + 1, codes };
    } else {
      tally = { ...tally, [outcome.kind]: tally[outcome.kind] + 1 };
    }
  }
  return tally;
}

function summarize(
  tally: Tally,
  items: number,
  malformed: number,
  dryRun: boolean,
): AutomationRunResult {
  const quiet = tally.newSent + tally.doneSent + tally.failed + malformed === 0;
  const base = quiet
    ? `변화 없음 (${items}행)`
    : `신규 ${tally.newSent}건 알림 · 완료 ${tally.doneSent}건 알림` +
      (tally.failed > 0
        ? ` · 실패 ${tally.failed}건 (${tally.codes.join(", ")})`
        : "") +
      (malformed > 0 ? ` · 형식이 맞지 않는 행 ${malformed}건` : "");
  return {
    ok: tally.failed === 0 && malformed === 0,
    message: dryRun ? `[DRY-RUN] ${base}` : base,
    details: {
      items,
      newSent: tally.newSent,
      doneSent: tally.doneSent,
      failed: tally.failed,
      malformed,
    },
  };
}

async function runWithItems(
  config: Config,
  items: Awaited<ReturnType<typeof fetchRequestItems>>,
): Promise<AutomationRunResult> {
  const db = createAdminClient();
  const now = new Date();
  const rows = await loadNoticeRows(db);
  if (rows.length === 0) {
    await insertNoticeRows(db, seedRows(items.items));
    const { malformed } = items;
    return {
      ok: malformed === 0,
      message:
        `처음 실행 — 기존 ${items.items.length}행 적재, 발송 없음` +
        (malformed > 0 ? ` · 형식이 맞지 않는 행 ${malformed}건` : ""),
      details: { items: items.items.length, malformed },
    };
  }
  const plan = reconcile(items.items, rows, now);
  await applyRecoveries(db, plan.recoveries, now);
  await insertNoticeRows(db, plan.inserts);
  await updateLastStatus(db, plan.statusUpdates, now);
  const tally = await deliverAll(db, plan.due, config, now);
  return summarize(tally, items.items.length, items.malformed, config.dryRun);
}

/**
 * AutomationJob.run — Teams 목록 'SMS 발신번호 사전등록 신청'을 훑어
 * 새 행은 담당 매니저에게, '완료' 전환은 신청자에게 메일을 보낸다.
 * 첫 실행은 기존 행을 적재만 한다. 메시지·details 에는 주소·이름을 싣지 않는다.
 */
export async function runSmsSenderRequestNotify(): Promise<AutomationRunResult> {
  const cfg = readConfig();
  if ("missing" in cfg) {
    return { ok: false, message: `환경변수 없음: ${cfg.missing.join(", ")}` };
  }
  const fetched = await fetchItems(cfg.config);
  if ("error" in fetched) return { ok: false, message: fetched.error };
  try {
    return await runWithItems(cfg.config, fetched.data);
  } catch (e) {
    console.error("[sms-request-notify] run error:", e);
    return { ok: false, message: DB_FAILED };
  }
}
