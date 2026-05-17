import { describe, it, expect } from "vitest";
import { DB_TABLES, formatDbSnapshot } from "../_db-shared";

describe("DB_TABLES", () => {
  it("핵심 테이블 정의 — 최소 10개", () => {
    expect(DB_TABLES.length).toBeGreaterThanOrEqual(10);
  });

  it("각 항목 — table + label", () => {
    for (const t of DB_TABLES) {
      expect(t.table).toBeTruthy();
      expect(t.label).toBeTruthy();
    }
  });
});

describe("formatDbSnapshot", () => {
  it("count 정수 → 'N건' 포맷", () => {
    expect(formatDbSnapshot(0)).toBe("0건");
    expect(formatDbSnapshot(17)).toBe("17건");
    expect(formatDbSnapshot(1234)).toBe("1,234건");
  });

  it("null → '집계 실패'", () => {
    expect(formatDbSnapshot(null)).toBe("집계 실패");
  });
});
