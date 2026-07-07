import "server-only";
import {
  countCompletedContracts,
  upsertCompletionSnapshot,
  kstYm,
} from "@/features/contracts/completion-snapshot";
import type { AutomationRunResult } from "../types";

/**
 * AutomationJob.run — 계약 '완료' 건수 월별 스냅샷.
 *
 * 엑셀은 셀 변경 시각을 남기지 않으므로, 현재 완료 건수를 현재 월(ym) 스냅샷으로 upsert한다.
 * 리포트의 '계약 체결' KPI가 이 스냅샷의 전월값과 비교해 증감을 산출한다.
 * 주기적(매일 권장) 실행으로 현재 월 값을 최신화 → 월이 바뀌면 직전 월 값이 그대로 고정된다.
 */
export async function runContractCompletionSnapshot(): Promise<AutomationRunResult> {
  try {
    const count = await countCompletedContracts();
    const ym = kstYm(new Date());
    await upsertCompletionSnapshot(ym, count);
    return {
      ok: true,
      message: `${ym} 계약완료 ${count}건 스냅샷 저장`,
      details: { completed: count },
    };
  } catch (e) {
    return {
      ok: false,
      message: `스냅샷 실패: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}
