import type { ListRow } from "../../../patterns/ListPattern";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SCHOOL_OWNER_HEADER_RE = /^학교\s*담당자?$|^학교\s*담당\s*이메일$/;

/**
 * 청구일자(text)로부터 오늘(KST)까지의 경과 일수.
 * 파싱 실패 또는 미래 일자면 null.
 */
export function elapsedDays(dateText?: string): number | null {
  if (!dateText) return null;
  const d = new Date(dateText.trim());
  if (Number.isNaN(d.getTime())) return null;
  const diff = Date.now() - d.getTime();
  if (diff < 0) return null;
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

/**
 * 다양한 한국식 날짜 표기를 input type="date" 가 받을 수 있는 ISO 8601 (YYYY-MM-DD) 으로 정규화.
 * 변환 실패 시 빈 문자열 — 사용자가 달력으로 새로 선택 가능.
 *
 * 지원 형식: 2026-05-30 / 2026.05.30 / 2026/05/30 / 2026년 5월 30일 / Excel serial(45777)
 */
export function toISODateInput(raw: string | undefined | null): string {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return s;

  const dotted = s.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/);
  if (dotted) {
    const [, y, m, d] = dotted;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const korean = s.match(/^(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (korean) {
    const [, y, m, d] = korean;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  const serial = Number(s);
  if (Number.isFinite(serial) && serial > 25569 && serial < 80000) {
    const ms = (serial - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) {
      const y = d.getUTCFullYear();
      const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
      const da = String(d.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${da}`;
    }
  }

  return "";
}

export function pickSchoolOwnerEmail(
  cells: ListRow["receivablesCells"],
): string | null {
  if (!cells) return null;
  const idx = cells.headers.findIndex((h) => SCHOOL_OWNER_HEADER_RE.test(h));
  if (idx === -1) return null;
  const raw = (cells.textValues[idx] ?? "").trim();
  if (!raw || !EMAIL_RE.test(raw)) return null;
  return raw;
}
