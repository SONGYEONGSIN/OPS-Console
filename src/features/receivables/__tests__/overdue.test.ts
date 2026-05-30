import { describe, it, expect } from "vitest";
import { computeElapsedDays } from "../overdue";

const now = new Date("2026-05-30T12:00:00+09:00");

describe("computeElapsedDays", () => {
  it("청구일자로부터 경과 일수를 내림 계산 (인스펙터 30일 경과와 동일)", () => {
    // 2026-04-30 → 2026-05-30 = 30일
    expect(computeElapsedDays("2026-04-30", now)).toBe(30);
  });

  it("같은 날이면 0일", () => {
    expect(computeElapsedDays("2026-05-30", now)).toBe(0);
  });

  it("미래 일자면 null", () => {
    expect(computeElapsedDays("2026-06-15", now)).toBeNull();
  });

  it("빈 값/파싱 실패면 null", () => {
    expect(computeElapsedDays("", now)).toBeNull();
    expect(computeElapsedDays(null, now)).toBeNull();
    expect(computeElapsedDays(undefined, now)).toBeNull();
    expect(computeElapsedDays("아무거나", now)).toBeNull();
  });

  it("앞뒤 공백을 허용", () => {
    expect(computeElapsedDays("  2026-05-20  ", now)).toBe(10);
  });
});
