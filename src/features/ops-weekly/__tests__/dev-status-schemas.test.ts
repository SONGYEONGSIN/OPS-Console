import { describe, expect, it } from "vitest";
import { devStatusIngestSchema, devStatusRunLogSchema } from "../dev-status-schemas";

const row = (id: number, t = "-") => ({ service_id: id, test_open: t });

describe("devStatusIngestSchema", () => {
  it.each([
    ["빈 배열", { rows: [] }],
    ["날짜만", { rows: [row(1000001, "2026-11-10")] }],
    ["글자", { rows: [row(1000001, "개발중")] }],
    ["0", { rows: [row(0)] }],
    ["문자 id", { rows: [{ service_id: "1000001", test_open: "-" }] }],
    ["중복", { rows: [row(1000001), row(1000001)] }],
    [
      "5,001행",
      { rows: Array.from({ length: 5001 }, (_, i) => row(1000001 + i)) },
    ],
  ])("거절: %s", (_, body) =>
    expect(devStatusIngestSchema.safeParse(body).success).toBe(false),
  );

  it("5,000행은 받는다", () => {
    expect(
      devStatusIngestSchema.safeParse({
        rows: Array.from({ length: 5000 }, (_, i) => row(1000001 + i)),
      }).success,
    ).toBe(true);
  });

  it("중복 메시지에 service_id 가 들어간다", () => {
    const r = devStatusIngestSchema.safeParse({
      rows: [row(7), row(7)],
    });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toBe("service_id 중복: 7");
  });
});

describe("devStatusRunLogSchema", () => {
  it("success·failed 와 1,000자 이하 메시지를 받는다", () => {
    expect(
      devStatusRunLogSchema.safeParse({ status: "success", message: "x".repeat(1000) }).success,
    ).toBe(true);
    expect(
      devStatusRunLogSchema.safeParse({ status: "failed", message: "" }).success,
    ).toBe(true);
  });

  it.each([
    ["skipped", { status: "skipped", message: "" }],
    ["1,001자", { status: "failed", message: "x".repeat(1001) }],
    ["메시지 없음", { status: "success" }],
  ])("거절: %s", (_, body) =>
    expect(devStatusRunLogSchema.safeParse(body).success).toBe(false),
  );
});
