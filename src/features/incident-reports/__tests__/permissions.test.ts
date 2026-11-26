import { describe, it, expect } from "vitest";
import { canCreateReport, canEditReport } from "../permissions";

const report = { author_email: "author@jinhakapply.com" };

describe("canEditReport — 본문 편집은 작성자·관리자만", () => {
  it("작성자 member 는 고친다", () => {
    expect(
      canEditReport(report, {
        email: "author@jinhakapply.com",
        permission: "member",
      }),
    ).toBe(true);
  });

  it("admin 은 남의 것도 고친다", () => {
    expect(
      canEditReport(report, {
        email: "boss@jinhakapply.com",
        permission: "admin",
      }),
    ).toBe(true);
  });

  it("작성자가 아닌 member 는 못 고친다 — 승인자(팀장)도 마찬가지", () => {
    expect(
      canEditReport(report, {
        email: "lead@jinhakapply.com",
        permission: "member",
      }),
    ).toBe(false);
  });

  it("작성자가 아닌 viewer·권한 없음은 못 고친다", () => {
    for (const permission of ["viewer", null]) {
      expect(
        canEditReport(report, { email: "x@jinhakapply.com", permission }),
      ).toBe(false);
    }
  });
});

describe("canCreateReport — 사고 등록과 같은 기준(활성 + admin·member)", () => {
  it("활성 admin·member 는 만든다", () => {
    for (const permission of ["admin", "member"]) {
      expect(canCreateReport({ permission, status: "active" })).toBe(true);
    }
  });

  it("viewer·권한 없음은 못 만든다", () => {
    for (const permission of ["viewer", null]) {
      expect(canCreateReport({ permission, status: "active" })).toBe(false);
    }
  });

  it("비활성 운영자는 admin 이어도 못 만든다", () => {
    expect(canCreateReport({ permission: "admin", status: "inactive" })).toBe(
      false,
    );
  });

  it("operators 행이 없으면 못 만든다", () => {
    expect(canCreateReport(null)).toBe(false);
  });
});
