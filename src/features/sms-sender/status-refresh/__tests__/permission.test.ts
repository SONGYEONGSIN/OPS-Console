import { describe, expect, it } from "vitest";
import { canRequestStatusRefresh } from "../permission";

describe("canRequestStatusRefresh", () => {
  it("admin 은 누구든", () => {
    expect(
      canRequestStatusRefresh({ email: "op-a", permission: "admin" }, "mgr-x"),
    ).toBe(true);
  });

  it("담당자 본인 — 공백·대소문자는 무시", () => {
    expect(
      canRequestStatusRefresh(
        { email: " MGR-X ", permission: "member" },
        "mgr-x",
      ),
    ).toBe(true);
  });

  it("담당자도 admin 도 아니면 불가", () => {
    expect(
      canRequestStatusRefresh({ email: "op-a", permission: "member" }, "mgr-x"),
    ).toBe(false);
  });

  it("빈 값끼리 같다고 보지 않는다", () => {
    expect(
      canRequestStatusRefresh({ email: "", permission: "member" }, ""),
    ).toBe(false);
    expect(
      canRequestStatusRefresh({ email: "  ", permission: "member" }, " "),
    ).toBe(false);
  });

  it("담당자 env 가 없으면 admin 만", () => {
    expect(
      canRequestStatusRefresh({ email: "op-a", permission: null }, undefined),
    ).toBe(false);
  });
});
