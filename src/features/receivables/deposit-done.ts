/**
 * 적요 칸이 '입금완료' 를 말하는가 — 공백은 무시한다(`입금 완료`, `11/20 입금완료 `).
 * 독려 메일은 이 경우에만 뺀다. 적요는 '통화함'·'확인중' 같은 메모로도 쓰여서,
 * 값이 있다는 이유만으로 빼면 아직 안 받은 돈의 독려가 조용히 멈춘다.
 */
export function isDepositDone(note: string): boolean {
  return note.replace(/\s+/g, "").includes("입금완료");
}
