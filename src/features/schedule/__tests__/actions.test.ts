import { describe, it, expect } from "vitest";
import { canEditScheduleEvent } from "../actions";
import type { CurrentOperator } from "@/features/auth/queries";

const baseOperator = {
  email: "ys1114@jinhakapply.com",
  operator: null,
  displayName: "송영신",
  role: "팀장",
  team: "운영2팀" as const,
  allowedMenus: [],
};

const admin: CurrentOperator = { ...baseOperator, permission: "admin" };
const member: CurrentOperator = {
  ...baseOperator,
  email: "kjn@jinhakapply.com",
  permission: "member",
};
const viewer: CurrentOperator = {
  ...baseOperator,
  email: "kjn@jinhakapply.com",
  permission: "viewer",
};

describe("canEditScheduleEvent", () => {
  it("admin — 모든 일정 편집 가능", () => {
    expect(
      canEditScheduleEvent(
        { created_by_email: "other@x.com", assignee_email: null },
        admin,
      ),
    ).toBe(true);
  });

  it("member — 본인이 created_by인 일정", () => {
    expect(
      canEditScheduleEvent(
        { created_by_email: "kjn@jinhakapply.com", assignee_email: null },
        member,
      ),
    ).toBe(true);
  });

  it("member — 본인이 assignee인 일정 (다른 사람이 작성한 본인 휴가 등)", () => {
    expect(
      canEditScheduleEvent(
        {
          created_by_email: "ys1114@jinhakapply.com",
          assignee_email: "kjn@jinhakapply.com",
        },
        member,
      ),
    ).toBe(true);
  });

  it("member — 무관한 타인 일정 차단", () => {
    expect(
      canEditScheduleEvent(
        {
          created_by_email: "ys1114@jinhakapply.com",
          assignee_email: "alcure23@jinhakapply.com",
        },
        member,
      ),
    ).toBe(false);
  });

  it("viewer — 본인 일정도 차단", () => {
    expect(
      canEditScheduleEvent(
        { created_by_email: "kjn@jinhakapply.com", assignee_email: null },
        viewer,
      ),
    ).toBe(false);
  });

  it("비로그인 (null) — 차단", () => {
    expect(
      canEditScheduleEvent(
        { created_by_email: "kjn@jinhakapply.com", assignee_email: null },
        null,
      ),
    ).toBe(false);
  });
});
