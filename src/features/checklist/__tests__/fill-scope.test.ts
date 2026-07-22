import { describe, it, expect } from "vitest";
import {
  assertWriteToken,
  assertItemInRound,
  type FillTokenRow,
} from "../fill-scope";

const fill: FillTokenRow = { round_id: "R1", kind: "fill", enabled: true };

describe("assertWriteToken — 통합 작성 링크 쓰기 권한 게이트", () => {
  it("활성 fill 토큰은 허용", () => {
    expect(assertWriteToken(fill)).toEqual({ ok: true });
  });
  it("비활성 토큰 거부", () => {
    expect(assertWriteToken({ ...fill, enabled: false })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });
  it("report 토큰으로 쓰기 거부", () => {
    expect(assertWriteToken({ ...fill, kind: "report" })).toEqual({
      ok: false,
      reason: "not-fill",
    });
  });
  it("토큰 없음(null) 거부", () => {
    expect(assertWriteToken(null)).toEqual({ ok: false, reason: "not-found" });
  });
});

describe("assertItemInRound — 항목이 토큰 회차 범위 내인가", () => {
  it("같은 회차 항목 허용 (부서 무관 — 전 부서 작성)", () => {
    expect(assertItemInRound({ round_id: "R1" }, fill)).toEqual({ ok: true });
  });
  it("타 회차 항목 거부", () => {
    expect(assertItemInRound({ round_id: "R2" }, fill)).toEqual({
      ok: false,
      reason: "wrong-round",
    });
  });
});
