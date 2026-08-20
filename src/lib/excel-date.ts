/**
 * 엑셀 일련번호 ↔ ISO 날짜.
 *
 * 엑셀은 **존재하지 않는 1900-02-29를 60번으로 센다**(로터스 호환). 그래서 기준을
 * 1899-12-30으로 잡아야 1900-03-01 이후가 맞는다. 하루 밀리면 장부가 통째로 어긋난다.
 *
 * 우편물 대장과 전도금 장부가 함께 쓴다 — 이 계산이 두 벌 생기면 한쪽만 고쳐진다.
 */

const EPOCH_MS = Date.UTC(1899, 11, 30);
const DAY_MS = 86_400_000;

export function excelSerialToIso(value: number | string): string {
  // 셀 서식이 섞여 있어 문자열 날짜가 그대로 오기도 한다.
  if (typeof value === "string") return value.trim();
  const ms = EPOCH_MS + Math.round(value) * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function isoToExcelSerial(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - EPOCH_MS) / DAY_MS);
}
