import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AutomationRunResult } from "@/features/automations/types";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailErrorCode } from "../mail-error-code";
import { MAX_ATTEMPTS } from "../request-notify/types";
import { SourceFetchError, fetchDocFiles } from "../source";
import type { RawDocFile } from "../types";
import { buildUploadMail } from "./mail";
import {
  reconcileUploads,
  seedUploadRows,
  type DueUpload,
  type UploadPlan,
} from "./reconcile";
import {
  claimUpload,
  fillHashes,
  finishUploads,
  insertUploadRows,
  loadUploadRows,
  rearmUploads,
  recoverUploads,
  updateHashes,
} from "./store";

const ENV_NAMES = [
  "SMS_SENDER_REQUEST_MANAGER_EMAIL",
  "SHAREPOINT_DRIVE_ID",
] as const;
const LIST_FAILED = "제출 서류 폴더를 읽지 못했습니다.";
const DB_FAILED = "제출 서류 업로드 알림 기록 처리 중 오류가 발생했습니다.";
const CLAIM_LOST_CODE = "claim_lost";

type Config = { manager: string; dryRun: boolean };
type Batch = {
  newSent: number;
  replacedSent: number;
  failed: number;
  codes: string[];
};
const NO_BATCH: Batch = { newSent: 0, replacedSent: 0, failed: 0, codes: [] };

function readConfig(): { config: Config } | { missing: string[] } {
  const missing = ENV_NAMES.filter((n) => !process.env[n]);
  if (missing.length > 0) return { missing };
  return {
    config: {
      manager: process.env.SMS_SENDER_REQUEST_MANAGER_EMAIL ?? "",
      dryRun: (process.env.MAIL_DRY_RUN ?? "").toLowerCase() === "true",
    },
  };
}

async function fetchFiles(): Promise<
  { data: RawDocFile[] } | { error: string }
> {
  try {
    return { data: await fetchDocFiles() };
  } catch (e) {
    if (e instanceof SourceFetchError) return { error: e.message };
    console.error("[sms-upload-notify] docs fetch error:", e);
    return { error: LIST_FAILED };
  }
}

/** 기록에서 돌려받은 id 만 나간 것으로 센다 — 그새 잡힌 행을 잃었으면 claim_lost. */
function tallySent(claimed: DueUpload[], done: string[]): Batch {
  const doneIds = new Set(done);
  const ok = claimed.filter((d) => doneIds.has(d.file.id));
  const lost = claimed.length - ok.length;
  if (lost > 0) console.error(`[sms-upload-notify] ${lost} rows lost claim`);
  return {
    newSent: ok.filter((d) => d.kind === "new").length,
    replacedSent: ok.filter((d) => d.kind === "replaced").length,
    failed: lost,
    codes: lost > 0 ? [CLAIM_LOST_CODE] : [],
  };
}

async function claimAll(
  db: SupabaseClient,
  due: DueUpload[],
  now: Date,
): Promise<DueUpload[]> {
  const claimed: DueUpload[] = [];
  for (const d of due) {
    if (await claimUpload(db, d.file.id, d.attempts, now)) claimed.push(d);
  }
  return claimed;
}

// 잡은 행만 메일 한 통에 묶는다. 실패하면 횟수가 다 찬 행은 failed, 나머지는 다음 실행으로.
async function deliverBatch(
  db: SupabaseClient,
  due: DueUpload[],
  config: Config,
  now: Date,
): Promise<Batch> {
  const claimed = await claimAll(db, due, now);
  if (claimed.length === 0) return NO_BATCH;
  const ids = claimed.map((d) => d.file.id);
  if (config.dryRun) {
    return tallySent(
      claimed,
      await finishUploads(db, ids, { state: "dry_run", now }),
    );
  }
  const { subject, html } = buildUploadMail(claimed);
  const res = await sendGraphMail({
    senderUserId: config.manager,
    toEmail: config.manager,
    subject,
    html,
  });
  if (res.ok) {
    const done = await finishUploads(db, ids, {
      state: "sent",
      messageId: res.messageId,
      now,
    });
    return tallySent(claimed, done);
  }
  const code = mailErrorCode(res.error);
  console.error(`[sms-upload-notify] send failed: ${code}`);
  const exhausted = claimed
    .filter((d) => d.attempts + 1 >= MAX_ATTEMPTS)
    .map((d) => d.file.id);
  const retry = ids.filter((id) => !exhausted.includes(id));
  await finishUploads(db, exhausted, { state: "failed", error: code, now });
  await finishUploads(db, retry, { state: "pending", error: code, now });
  return { ...NO_BATCH, failed: claimed.length, codes: [code] };
}

function summarizeUploads(
  batch: Batch,
  files: number,
  skippedSelf: number,
): AutomationRunResult {
  const sent = batch.newSent + batch.replacedSent;
  const quiet = sent + batch.failed + skippedSelf === 0;
  const message = quiet
    ? `변화 없음 (파일 ${files}개)`
    : `새 파일 ${batch.newSent}건 · 교체 ${batch.replacedSent}건 알림` +
      (skippedSelf > 0 ? ` · 담당자 본인 업로드 ${skippedSelf}건 제외` : "") +
      (batch.failed > 0
        ? ` · 실패 ${batch.failed}건 (${[...new Set(batch.codes)].join(", ")})`
        : "");
  return {
    ok: batch.failed === 0,
    message,
    details: {
      uploadFiles: files,
      uploadNew: batch.newSent,
      uploadReplaced: batch.replacedSent,
      uploadSkippedSelf: skippedSelf,
      uploadFailed: batch.failed,
    },
  };
}

async function applyPlan(
  db: SupabaseClient,
  plan: UploadPlan,
  now: Date,
): Promise<void> {
  await recoverUploads(db, plan.recoveries, now);
  await rearmUploads(db, plan.rearms, now);
  await fillHashes(db, plan.fills, now);
  await updateHashes(db, plan.hashUpdates, now);
  await insertUploadRows(db, plan.inserts);
}

async function runWithFiles(
  config: Config,
  files: RawDocFile[],
): Promise<AutomationRunResult> {
  const db = createAdminClient();
  const now = new Date();
  const rows = await loadUploadRows(db);
  if (rows.length === 0) {
    await insertUploadRows(db, seedUploadRows(files));
    return {
      ok: true,
      message: `처음 실행 — 기존 파일 ${files.length}개 적재, 발송 없음`,
      details: { uploadFiles: files.length },
    };
  }
  const plan = reconcileUploads(files, rows, config.manager, now);
  await applyPlan(db, plan, now);
  const batch = await deliverBatch(db, plan.due, config, now);
  return summarizeUploads(batch, files.length, plan.skippedSelf);
}

/**
 * 신청 알림 잡의 두 번째 단계 — '03. 학교별 제출 서류' 폴더의 새 파일·교체(PDF)를
 * 담당 매니저에게 한 통으로 묶어 알린다. 첫 실행은 기존 파일을 적재만 한다.
 * 던지지 않는다. 메시지·details 에는 주소·이름을 싣지 않는다. [DRY-RUN] 머리는 합치는 쪽이 붙인다.
 */
export async function runDocUploadStep(): Promise<AutomationRunResult> {
  const cfg = readConfig();
  if ("missing" in cfg) {
    return { ok: false, message: `환경변수 없음: ${cfg.missing.join(", ")}` };
  }
  const fetched = await fetchFiles();
  if ("error" in fetched) return { ok: false, message: fetched.error };
  try {
    return await runWithFiles(cfg.config, fetched.data);
  } catch (e) {
    console.error("[sms-upload-notify] run error:", e);
    return { ok: false, message: DB_FAILED };
  }
}
