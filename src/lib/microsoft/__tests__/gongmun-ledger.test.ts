import { describe, it, expect } from "vitest";
import { formatDocPrefix, nextDocNumber } from "../gongmun-ledger";

// 시행번호 = 운영 + YY + MM + '-' + DD + 일련번호2자리 (그날 순번)
// 예 운영2512-1603 = 2025-12-16 그날 3번째

describe("formatDocPrefix", () => {
  it("운영{YY}{MM}-{DD}", () => {
    expect(formatDocPrefix(new Date(2026, 5, 2))).toBe("운영2606-02"); // 2026-06-02
    expect(formatDocPrefix(new Date(2025, 11, 16))).toBe("운영2512-16"); // 2025-12-16
  });
});

describe("nextDocNumber", () => {
  it("그날 기존 번호 없으면 01", () => {
    expect(nextDocNumber([], new Date(2026, 5, 2))).toBe("운영2606-0201");
  });

  it("그날 최대 NN + 1", () => {
    const existing = ["운영2606-0201", "운영2606-0202", "운영2605-2901"];
    expect(nextDocNumber(existing, new Date(2026, 5, 2))).toBe("운영2606-0203");
  });

  it("다른 날 번호는 무시 (DD 단위 순번)", () => {
    const existing = ["운영2606-0205", "운영2606-0301"]; // 06-02는 05까지
    expect(nextDocNumber(existing, new Date(2026, 5, 3))).toBe("운영2606-0302");
  });

  it("공백/잡음 행 안전 처리", () => {
    const existing = ["", "  ", "메모", "운영2606-0201"];
    expect(nextDocNumber(existing, new Date(2026, 5, 2))).toBe("운영2606-0202");
  });
});
