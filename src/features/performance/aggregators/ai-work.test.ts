import { describe, it, expect } from "vitest";
import { aggregateAiWork } from "./ai-work";

const P = { startYmd: "2026-01-01", endYmd: "2026-06-30" };

describe("aggregateAiWork", () => {
  const rows = [
    { author_email: "me@x.com", created_at: "2026-02-01T00:00:00Z" },
    { author_email: "me@x.com", created_at: "2026-03-01T00:00:00Z" },
    { author_email: "me@x.com", created_at: "2025-11-01T00:00:00Z" }, // 범위 밖
    { author_email: "other@x.com", created_at: "2026-02-01T00:00:00Z" },
  ];
  it("본인+기간 AI 결과물 수 = 2", () => {
    expect(aggregateAiWork(rows, "me@x.com", P).value).toBe(2);
  });
});
