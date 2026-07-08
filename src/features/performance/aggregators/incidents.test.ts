import { describe, it, expect } from "vitest";
import { aggregateIncidents } from "./incidents";

const P = { startYmd: "2026-01-01", endYmd: "2026-06-30" };

describe("aggregateIncidents", () => {
  const rows = [
    { assignee_email: "me@x.com", status: "처리완료", created_at: "2026-02-01T00:00:00Z" },
    { assignee_email: "me@x.com", status: "처리중", created_at: "2026-02-02T00:00:00Z" },
    { assignee_email: "other@x.com", status: "처리완료", created_at: "2026-02-01T00:00:00Z" },
    { assignee_email: "me@x.com", status: "처리완료", created_at: "2025-12-01T00:00:00Z" }, // 범위 밖
  ];
  it("본인+기간 처리완료율 = 완료/전체 (1/2 → 50)", () => {
    const r = aggregateIncidents(rows, "me@x.com", P);
    expect(r.value).toBe(50);
    expect(r.detail).toContain("1/2");
  });
  it("담당 사고 0건이면 무사고 = 100", () => {
    expect(aggregateIncidents(rows, "none@x.com", P).value).toBe(100);
  });
});
