import "server-only";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import {
  fetchDepositSheet,
  depositFetchFailMessage,
} from "@/features/receivables-match/deposit-queries";
import { patchMatchResult } from "@/features/receivables-match/patch";
import { sendMismatchReport } from "@/features/receivables-match/mismatch-mail";
import { runMatch } from "@/features/receivables-match/algorithm";
import { fetchMatchAliases } from "@/features/receivables-match/alias-queries";
import { toMisuRows } from "@/features/receivables-match/misu-rows";
import {
  enrichMatchedForLog,
  formatKrw,
} from "@/features/automations/run-logs-normalize";
import type {
  MatchPair,
  MismatchPair,
} from "@/features/receivables-match/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AutomationRunResult } from "../types";

function readDryRun(): boolean {
  return (process.env.MAIL_MATCH_DRY_RUN ?? "true").toLowerCase() === "true";
}

const MISU_SHEET_NAME_FALLBACK = "미수채권";
const DEPOSIT_SHEET_NAME_FALLBACK = "수수료입금내역조회";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * AutomationJob.run — 입금 매칭 자동화.
 *
 * 1. 미수 시트 + 입금 시트 fetch
 * 2. runMatch (pure) — 단건/N:1/N:M + mismatch detect
 * 3. patchMatchResult — 매칭 쌍별 K/J PATCH (dry-run 모드 분기, 1초 throttle)
 * 4. sendMismatchReport — admin 알림 메일 (mismatch 0건이면 skip)
 * 5. receivables_match_runs 이력 insert
 *
 * 환경 변수:
 * - MAIL_MATCH_DRY_RUN=true (default) → patch skip, mode=dry_run 적재
 * - SHAREPOINT_DEPOSIT_ITEM_ID (필수)
 */
export async function runReceivablesDepositMatch(): Promise<AutomationRunResult> {
  const startedAt = new Date();
  const misuSheet = await fetchReceivablesSheet();
  if (!misuSheet) {
    return {
      ok: false,
      message:
        "SharePoint 미수채권 시트 fetch 실패 — SHAREPOINT_RECEIVABLES_* 환경변수 확인",
    };
  }
  const deposits = await fetchDepositSheet();
  if (deposits === null) {
    return {
      ok: false,
      message: depositFetchFailMessage(
        Boolean(process.env.SHAREPOINT_DEPOSIT_ITEM_ID),
      ),
    };
  }

  const misuRows = toMisuRows(misuSheet);
  // admin이 불일치 승인으로 학습한 alias 로드 → 매칭에 반영 (서강국제대학원 → 서강대 등).
  const aliases = await fetchMatchAliases();
  const result = runMatch(misuRows, deposits, aliases);
  const dryRun = readDryRun();
  const mode = dryRun ? "dry_run" : "live";

  const errors: string[] = [];
  // 이미 입금완료라 PATCH를 건너뛴 양성 스킵 — 에러가 아니므로 ok/error_count에서 제외.
  // 이력 가시성을 위해 payload.skips로 별도 보관한다.
  const skips: string[] = [];
  // 미수행 번호 → 거래처명 (skip 로그에 행번호 대신 거래처/금액 표시).
  const misuByRow = new Map(misuRows.map((m) => [m.rowNumber, m.customer]));
  const successfulPatches: MatchPair[] = [];
  for (let i = 0; i < result.matched.length; i++) {
    const pair = result.matched[i];
    const patchRes = await patchMatchResult(
      pair,
      misuSheet.worksheetName || MISU_SHEET_NAME_FALLBACK,
      DEPOSIT_SHEET_NAME_FALLBACK,
      { dryRun },
    );
    if (patchRes.ok) {
      successfulPatches.push(pair);
    } else if (patchRes.skipped) {
      const misuRowNum = pair.misuRows[0];
      const customer = misuByRow.get(misuRowNum) ?? `행${misuRowNum}`;
      skips.push(`${formatKrw(pair.amount)} ${customer} 이미 입금완료 — skip`);
    } else if (patchRes.errorMessage) {
      errors.push(patchRes.errorMessage);
    }
    // 1초 throttle (마지막 제외)
    if (!dryRun && i < result.matched.length - 1) {
      await sleep(1000);
    }
  }

  const mismatchRes = await sendMismatchReport(result.mismatches, { dryRun });
  if (!mismatchRes.ok && mismatchRes.errorMessage) {
    errors.push(`mismatch mail: ${mismatchRes.errorMessage}`);
  }

  const finishedAt = new Date();

  // 이력 적재
  const admin = createAdminClient();
  await admin.from("receivables_match_runs").insert([
    {
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      mode,
      matched_count: successfulPatches.length,
      mismatch_count: result.mismatches.length,
      error_count: errors.length,
      payload: {
        // 로그에 행번호 대신 거래처/거래내용 값을 표시하기 위해 이름 보강.
        matched: enrichMatchedForLog(result.matched, misuRows, deposits),
        mismatches: result.mismatches,
        errors,
        skips,
      },
      notes: dryRun ? "DRY RUN — PATCH 호출 없음" : null,
    },
  ]);

  const tag = dryRun ? "[DRY-RUN]" : "";
  const skipTag = skips.length > 0 ? ` / skips ${skips.length}` : "";
  return {
    ok: errors.length === 0,
    message:
      `${tag} matched ${result.matched.length} / mismatch ${result.mismatches.length} / errors ${errors.length}${skipTag}`.trim(),
    details: {
      matched: result.matched.length,
      mismatches: result.mismatches.length,
      errors: errors.length,
      unmatchedMisu: result.unmatchedMisu.length,
      unmatchedDep: result.unmatchedDep.length,
    },
  };
}

// MismatchPair는 미사용 (import만 placeholder) — 향후 추가 reporting 위해 export 유지
void ({} as MismatchPair);
