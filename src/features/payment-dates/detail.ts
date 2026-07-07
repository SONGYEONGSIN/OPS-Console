/**
 * 비용지급일 인스펙터 표시용 순수 파생 함수 (UI 무관, 테스트 대상).
 */

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

function parseYmd(ymd: string): { y: number; m: number; d: number } | null {
  const mt = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!mt) return null;
  return { y: Number(mt[1]), m: Number(mt[2]), d: Number(mt[3]) };
}

/** "2026-07-09" → "2026년 7월 9일 (목)". 형식 오류 → "-". */
export function formatYmdWithWeekday(ymd: string): string {
  const p = parseYmd(ymd);
  if (!p) return "-";
  const wd = WEEKDAYS[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  return `${p.y}년 ${p.m}월 ${p.d}일 (${wd})`;
}

/** (ymd - todayYmd) 자연일 차이. 미래 양수 / 과거 음수 / 당일 0. 형식 오류 → null. */
export function dayDiffFromToday(ymd: string, todayYmd: string): number | null {
  const a = parseYmd(ymd);
  const b = parseYmd(todayYmd);
  if (!a || !b) return null;
  const ta = Date.UTC(a.y, a.m - 1, a.d);
  const tb = Date.UTC(b.y, b.m - 1, b.d);
  return Math.round((ta - tb) / 86_400_000);
}

/**
 * 시트명에서 회계 기수·연도 범위 파싱.
 * "27기비용지급일(26.04~27.03)" → { term: "27기", fiscal: "2026.04 ~ 2027.03" }.
 * 범위 접미사 없으면 fiscal=null, 기수 없으면 term=null.
 */
export function parseFiscalFromSheet(sheet: string): {
  term: string | null;
  fiscal: string | null;
} {
  const t = /^(\d+)기/.exec(sheet.trim());
  const term = t ? `${t[1]}기` : null;
  const r = /\((\d{2})\.(\d{2})\s*~\s*(\d{2})\.(\d{2})\)/.exec(sheet);
  const fiscal = r ? `20${r[1]}.${r[2]} ~ 20${r[3]}.${r[4]}` : null;
  return { term, fiscal };
}
