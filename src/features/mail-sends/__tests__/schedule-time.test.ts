import { describe, it, expect } from "vitest";
import { parseScheduledAtKst } from "../schedule-time";

/**
 * data-requests/schedule-time.ts 에서 이관 (규칙 변경 없음).
 * `+09:00` 오프셋은 한 벌만 존재해야 한다 — 예약 발송 시각이 조용히
 * 9시간 어긋나는 사고를 막는 자리다.
 */
describe("parseScheduledAtKst", () => {
  it("KST datetime-local → UTC Date", () => {
    expect(parseScheduledAtKst("2026-05-25T14:30")?.toISOString()).toBe("2026-05-25T05:30:00.000Z");
  });
  it("초 포함 입력도 처리", () => {
    expect(parseScheduledAtKst("2026-05-25T14:30:00")?.toISOString()).toBe("2026-05-25T05:30:00.000Z");
  });
  it("겨울 날짜도 같은 오프셋 (backup-requests 에서 이관)", () => {
    // KST 2026-12-01 10:00 = UTC 2026-12-01 01:00
    expect(parseScheduledAtKst("2026-12-01T10:00")?.toISOString()).toBe("2026-12-01T01:00:00.000Z");
    expect(parseScheduledAtKst("2026-12-01T10:00:00")?.toISOString()).toBe("2026-12-01T01:00:00.000Z");
  });

  it("빈 값/잘못된 값 → null", () => {
    expect(parseScheduledAtKst("")).toBeNull();
    expect(parseScheduledAtKst("nope")).toBeNull();
    expect(parseScheduledAtKst("not-a-date")).toBeNull();
  });
});
