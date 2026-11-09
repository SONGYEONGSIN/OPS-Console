import { describe, expect, it } from "vitest";
import { reviewHalfFor } from "../half";

describe("reviewHalfFor", () => {
  it("8월은 그해 1·2분기(4~9월)", () => {
    expect(reviewHalfFor(new Date("2026-08-03T01:00:00Z"))).toEqual({
      key: "2026-H1",
      label: "1·2분기(4~9월)",
      month: 8,
    });
  });

  it("3월은 전년 3·4분기(10~3월)", () => {
    expect(reviewHalfFor(new Date("2027-03-02T01:00:00Z"))).toEqual({
      key: "2026-H2",
      label: "3·4분기(10~3월)",
      month: 3,
    });
  });

  it("KST 로 월을 가른다 — UTC 7/31 15:30 은 KST 8/1", () => {
    expect(reviewHalfFor(new Date("2026-07-31T15:30:00Z"))?.key).toBe(
      "2026-H1",
    );
  });

  it("KST 9/1 0시부터는 대상이 아니다", () => {
    expect(reviewHalfFor(new Date("2026-08-31T15:00:00Z"))).toBeNull();
  });

  it("3월·8월이 아니면 null", () => {
    expect(reviewHalfFor(new Date("2026-11-09T01:00:00Z"))).toBeNull();
  });
});
