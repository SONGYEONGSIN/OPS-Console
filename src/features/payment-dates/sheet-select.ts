/**
 * 워크시트 이름 목록에서 `NN기비용지급일...` 중 **최대 기수** 시트명을 고른다.
 * 예: ["25기비용지급일(...)", "27기비용지급일(26.04~27.03)"] → "27기비용지급일(26.04~27.03)".
 * 기수는 숫자로 비교 (문자열 "9" > "27" 오류 회피). 매칭 없으면 null. visibility는 무관.
 */
const SHEET_RE = /^(\d+)기비용지급일/;

export function selectLatestPaymentSheet(names: string[]): string | null {
  let best: { name: string; n: number } | null = null;
  for (const name of names) {
    const m = SHEET_RE.exec(name.trim());
    if (!m) continue;
    const n = Number(m[1]);
    if (best === null || n > best.n) {
      best = { name, n };
    }
  }
  return best?.name ?? null;
}
