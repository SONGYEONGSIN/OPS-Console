import { describe, it, expect } from "vitest";
import { aggregateClosing } from "./closing";

const P = { startYmd: "2026-01-01", endYmd: "2026-06-30" };

describe("aggregateClosing", () => {
  const rows = [
    { operator_name: "송영신", write_end_at: "2026-03-10T00:00:00Z" },
    { operator_name: "송영신", write_end_at: "2026-08-10T00:00:00Z" }, // 범위 밖
    { operator_name: "김슬기", write_end_at: "2026-03-10T00:00:00Z" }, // 타인
    { operator_name: "송영신", write_end_at: null }, // 마감 미완
  ];
  it("본인(이름) + 기간 내 마감 완수만 카운트", () => {
    expect(aggregateClosing(rows, "송영신", P).value).toBe(1);
  });
  it("이름 null(미매칭)이면 0 — silent fallback 없이 미매칭 처리", () => {
    expect(aggregateClosing(rows, null, P).value).toBe(0);
    expect(aggregateClosing(rows, null, P).detail).toBe("미매칭");
  });
});
