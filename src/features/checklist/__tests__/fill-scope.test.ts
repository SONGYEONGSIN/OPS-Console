import { describe, it, expect } from "vitest";
import {
  assertDeptFillToken,
  assertItemInScope,
  type FillTokenRow,
} from "../fill-scope";

const deptFill: FillTokenRow = {
  round_id: "R1",
  department: "개발부",
  kind: "dept-fill",
  enabled: true,
};

describe("assertDeptFillToken — 공개 쓰기 권한 게이트", () => {
  it("활성 dept-fill 토큰은 허용", () => {
    expect(assertDeptFillToken(deptFill)).toEqual({ ok: true });
  });
  it("(c) 비활성 토큰 거부", () => {
    expect(assertDeptFillToken({ ...deptFill, enabled: false })).toEqual({
      ok: false,
      reason: "disabled",
    });
  });
  it("(d) report 토큰으로 쓰기 거부", () => {
    expect(assertDeptFillToken({ ...deptFill, kind: "report" })).toEqual({
      ok: false,
      reason: "not-dept-fill",
    });
  });
  it("토큰 없음(null) 거부", () => {
    expect(assertDeptFillToken(null)).toEqual({ ok: false, reason: "not-found" });
  });
  it("부서 없는 dept-fill 거부", () => {
    expect(assertDeptFillToken({ ...deptFill, department: null })).toEqual({
      ok: false,
      reason: "no-department",
    });
  });
});

describe("assertItemInScope — 항목이 토큰 (회차,부서) 범위 내인가", () => {
  it("(a) 같은 회차·부서 항목 허용", () => {
    expect(
      assertItemInScope({ round_id: "R1", department: "개발부" }, deptFill),
    ).toEqual({ ok: true });
  });
  it("(b) 타 부서 항목 거부", () => {
    expect(
      assertItemInScope({ round_id: "R1", department: "운영부" }, deptFill),
    ).toEqual({ ok: false, reason: "wrong-department" });
  });
  it("타 회차 항목 거부", () => {
    expect(
      assertItemInScope({ round_id: "R2", department: "개발부" }, deptFill),
    ).toEqual({ ok: false, reason: "wrong-round" });
  });
});
