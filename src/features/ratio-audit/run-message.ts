import type { RatioAuditKind } from "./schemas";
import type { RatioDispatchResult } from "./dispatch";
import type { summarizeRatioAudit } from "./summary";

/** summarizeRatioAudit 의 반환 타입 — 그쪽에 이름이 없어 여기서 끌어 쓴다. */
type RatioAuditSummary = ReturnType<typeof summarizeRatioAudit>;

/**
 * 점검 결과를 자동화 실행 로그의 한 줄로.
 *
 * 지금까지 그 로그에 남던 건 **큐 적재뿐**이었다. 그래서 8/3 실행이 트레이스백으로
 * 죽었는데도 화면엔 "성공"이 떠 있었고, `ratio_audit_runs`는 한 번도 채워진 적이
 * 없었다(2026-08-19 확인). 실행 여부도 결과도 화면에서 알 수 없었다.
 *
 * 문장은 미수채권 운영자 알림과 같은 결로 맞춘다 — 무엇을 몇 건 처리했고
 * 몇 건이 실패했는지가 한 줄에 다 있어야 한다.
 */

/** kind → 자동화 잡 id. 둘은 **다른 잡**이라 섞으면 안 도는 잡이 도는 줄 안다. */
export function automationJobIdFor(kind: RatioAuditKind): string {
  if (kind === "schedule") return "ratio-audit";
  if (kind === "page") return "ratio-page-check";
  // 조용히 하나로 몰면 그 잡의 미실행 감지가 영영 안 걸린다.
  throw new Error(`알 수 없는 점검 종류: ${kind}`);
}

export function buildRunMessage(
  summary: RatioAuditSummary,
  dispatch: RatioDispatchResult,
): string {
  const parts = [`검사 ${summary.scannedCount}건`];

  // 이상 0건도 명시한다 — 빈 줄이면 안 돈 것과 구분이 안 된다.
  parts.push(
    summary.findingCount > 0 ? `이상 ${summary.findingCount}건` : "이상 없음",
  );
  if (summary.linkErrorCount > 0) {
    parts.push(`링크오류 ${summary.linkErrorCount}건`);
  }

  parts.push(`발송 ${dispatch.sent}명`);
  if (dispatch.failed.length > 0) {
    // 판정은 됐는데 아무도 못 받은 경우가 최악이라 반드시 드러낸다.
    parts.push(`발송실패 ${dispatch.failed.length}명`);
  }
  if (dispatch.unassignedCount > 0) {
    parts.push(`담당미상 ${dispatch.unassignedCount}건`);
  }
  if (dispatch.excludedCount > 0) {
    parts.push(`예외제외 ${dispatch.excludedCount}건`);
  }
  if (summary.status === "partial") {
    parts.push("일부 건너뜀");
  }

  return parts.join(" · ");
}
