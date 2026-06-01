"use server";

import { requireAdmin } from "@/features/auth/permission";
import { logActivity } from "@/features/worklog/log";
import { fetchReceivablesSheet } from "@/features/receivables/queries";
import { fetchDepositSheet } from "./deposit-queries";
import { insertMatchAlias, fetchMatchAliases } from "./alias-queries";
import { toMisuRows } from "./misu-rows";
import { runMatch } from "./algorithm";
import { normalizeName } from "./normalize";
import { patchMatchResult } from "./patch";

const MISU_SHEET_NAME_FALLBACK = "미수채권";
const DEPOSIT_SHEET_NAME_FALLBACK = "수수료입금내역조회";

function isDryRun(): boolean {
  return (process.env.MAIL_MATCH_DRY_RUN ?? "true").toLowerCase() === "true";
}

export type ApplyMismatchInput = {
  misuRow: number;
  depRow: number;
  misuCustomer: string;
  depContent: string;
};

export type ApplyMismatchResult =
  | { ok: true; patched: boolean; message: string }
  | { ok: false; message: string };

/**
 * 불일치(금액 일치·이름 불일치) 승인 — admin only.
 * 1) 학습: 입금 거래내용 → 미수 거래처 정규화값 alias 저장 (다음 실행부터 자동 매칭)
 * 2) 즉시 적용: 현재 시트 재fetch + alias 반영 매칭 후 해당 입금행 쌍만 PATCH.
 *    시트가 이미 변해 매칭 안 되면 학습만 하고 다음 실행에 위임(patched:false).
 */
export async function applyMismatchAsMatch(
  input: ApplyMismatchInput,
): Promise<ApplyMismatchResult> {
  const me = await requireAdmin();

  const aliasKey = input.depContent.replace(/\s+/g, "");
  const aliasValue = normalizeName(input.misuCustomer);
  if (!aliasKey || !aliasValue) {
    return { ok: false, message: "거래처/거래내용이 비어 학습할 수 없습니다." };
  }

  const ins = await insertMatchAlias({
    alias_key: aliasKey,
    alias_value: aliasValue,
    source_misu_customer: input.misuCustomer,
    source_dep_content: input.depContent,
    created_by: me.email,
  });
  if (!ins.ok) {
    return { ok: false, message: `alias 저장 실패: ${ins.error ?? "unknown"}` };
  }

  // 즉시 적용 — 현재 시트 + 학습 alias로 재매칭 후 해당 입금행 PATCH.
  // 시트 fetch/patch(SharePoint)가 실패해도 alias는 이미 저장됐으므로 throw하지 않고
  // patched:false로 둔다 (다음 실행에서 자동 매칭). 액션이 항상 결과를 반환해야
  // 버튼이 완료 피드백을 받는다.
  let patched = false;
  try {
    const misuSheet = await fetchReceivablesSheet();
    const deposits = await fetchDepositSheet();
    if (misuSheet && deposits) {
      const aliases = await fetchMatchAliases();
      const result = runMatch(toMisuRows(misuSheet), deposits, aliases);
      const pair = result.matched.find((p) => p.depRows.includes(input.depRow));
      if (pair) {
        const patchRes = await patchMatchResult(
          pair,
          misuSheet.worksheetName || MISU_SHEET_NAME_FALLBACK,
          DEPOSIT_SHEET_NAME_FALLBACK,
          { dryRun: isDryRun() },
        );
        patched = patchRes.ok;
      }
    }
  } catch (e) {
    console.error("[applyMismatchAsMatch] 즉시 매칭 실패 (학습은 유지):", e);
  }

  await logActivity({
    domain: "receivables-match",
    action: "apply-mismatch",
    target_type: "receivables_match_aliases",
    target_name: `${input.misuCustomer} ↔ ${input.depContent}`,
    msg: `불일치 승인 학습 (${aliasKey}→${aliasValue})${patched ? " + 즉시 매칭" : " (다음 실행 시 적용)"}`,
    metadata: { misuRow: input.misuRow, depRow: input.depRow },
  });

  // revalidatePath 미사용 — 로그 패널은 클라이언트 fetch(openLog)라 서버 캐시
  // 무효화 불필요. 호출 시 라우터 리프레시가 버튼의 완료 상태를 리셋하던 부작용 제거.
  return {
    ok: true,
    patched,
    message: patched
      ? "매칭 적용 + 학습 완료 — 다음부터 자동 매칭됩니다."
      : "학습 저장됨 — 다음 실행 시 자동 매칭됩니다.",
  };
}
