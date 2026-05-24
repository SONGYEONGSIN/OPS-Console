/**
 * Google 'Holidays in South Korea' 공개 캘린더 iCal feed.
 * 인증 불필요, 외부 종속성 없음. Next fetch revalidate로 24h 캐시.
 */
export type Holiday = {
  /** 'YYYY-MM-DD' (KST 날짜) */
  date: string;
  title: string;
};

const KOREAN_HOLIDAYS_ICS_URL =
  "https://calendar.google.com/calendar/ical/ko.south_korea%23holiday%40group.v.calendar.google.com/public/basic.ics";

/** ICS 텍스트 → Holiday[]. DTSTART;VALUE=DATE만 처리 (종일 이벤트). */
export function parseIcs(text: string): Holiday[] {
  const holidays: Holiday[] = [];
  const lines = text.split(/\r?\n/);
  let inEvent = false;
  let date: string | null = null;
  let title: string | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inEvent = true;
      date = null;
      title = null;
      continue;
    }
    if (line === "END:VEVENT") {
      if (inEvent && date && title) {
        holidays.push({ date, title });
      }
      inEvent = false;
      continue;
    }
    if (!inEvent) continue;

    // DTSTART;VALUE=DATE:YYYYMMDD
    const dtMatch = /^DTSTART(?:;[^:]+)?:(\d{8})$/.exec(line);
    if (dtMatch) {
      const ymd = dtMatch[1];
      date = `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}`;
      continue;
    }
    // SUMMARY:...
    if (line.startsWith("SUMMARY:")) {
      title = line.slice("SUMMARY:".length).trim();
    }
  }

  return holidays;
}

/** Google 한국 공휴일 캘린더 fetch + 파싱. 24h revalidate 캐시. */
export async function fetchKoreanHolidays(): Promise<Holiday[]> {
  const res = await fetch(KOREAN_HOLIDAYS_ICS_URL, {
    next: { revalidate: 86400 },
  });
  if (!res.ok) return [];
  const text = await res.text();
  return parseIcs(text);
}
