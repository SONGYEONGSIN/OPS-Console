/**
 * _서류 시트의 표시 → 화면 글자. 학교 표의 서류 점과 인스펙터가 같이 쓴다.
 * '대' 는 '대체' 에만 준다 — 모르는 표시(X·× 등)까지 '대' 로 그리면
 * 미제출이 '대체 인정' 으로 뒤집혀 보이고 아무 오류도 안 난다.
 */
export function markGlyph(mark: string): string {
  if (mark === "O" || mark === "✕") return mark;
  if (mark === "대체") return "대";
  return mark ? "?" : "·";
}

export const markClass = (mark: string) =>
  mark === "O" ? "text-ink" : mark === "✕" ? "text-vermilion" : "text-muted";
