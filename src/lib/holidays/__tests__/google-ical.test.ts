import { describe, it, expect } from "vitest";
import { parseIcs } from "../google-ical";

const SAMPLE_ICS = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Google Inc//Google Calendar 70.9054//EN
X-WR-CALNAME:Holidays in South Korea
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260101
DTEND;VALUE=DATE:20260102
SUMMARY:신정
UID:20260101_holiday@google.com
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260301
DTEND;VALUE=DATE:20260302
SUMMARY:삼일절
UID:20260301_holiday@google.com
END:VEVENT
BEGIN:VEVENT
DTSTART;VALUE=DATE:20260505
DTEND;VALUE=DATE:20260506
SUMMARY:어린이날
UID:20260505_holiday@google.com
END:VEVENT
END:VCALENDAR
`;

describe("parseIcs — Google Korean holidays ics", () => {
  it("VEVENT 3건을 Holiday[]로 파싱", () => {
    const holidays = parseIcs(SAMPLE_ICS);
    expect(holidays).toHaveLength(3);
  });

  it("DTSTART;VALUE=DATE:YYYYMMDD → 'YYYY-MM-DD' 정규화", () => {
    const holidays = parseIcs(SAMPLE_ICS);
    expect(holidays[0].date).toBe("2026-01-01");
    expect(holidays[1].date).toBe("2026-03-01");
    expect(holidays[2].date).toBe("2026-05-05");
  });

  it("SUMMARY 한국어 그대로 보존", () => {
    const holidays = parseIcs(SAMPLE_ICS);
    expect(holidays[0].title).toBe("신정");
    expect(holidays[1].title).toBe("삼일절");
    expect(holidays[2].title).toBe("어린이날");
  });

  it("VEVENT 블록 외부 텍스트는 무시", () => {
    const noisy = `garbage line\n${SAMPLE_ICS}\ntrailing junk`;
    expect(parseIcs(noisy)).toHaveLength(3);
  });

  it("DTSTART 누락 VEVENT는 결과에서 제외 (방어)", () => {
    const ics = `BEGIN:VCALENDAR
BEGIN:VEVENT
SUMMARY:이상한 일정
END:VEVENT
END:VCALENDAR`;
    expect(parseIcs(ics)).toHaveLength(0);
  });

  it("빈 문자열 → 빈 배열", () => {
    expect(parseIcs("")).toEqual([]);
  });
});
