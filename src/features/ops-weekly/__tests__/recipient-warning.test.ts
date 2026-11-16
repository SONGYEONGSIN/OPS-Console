import { describe, expect, it, vi } from "vitest";
import { recipientWarning, type RecipientOperator } from "../roster";

// 정책 집합만 바꾼다 — canViewMenu 는 그대로 타야 판정 경로를 검증한다.
vi.mock("@/app/dashboard/_data/sidebar-helpers", async (orig) => ({
  ...(await orig<typeof import("@/app/dashboard/_data/sidebar-helpers")>()),
  DESIGNATED_ONLY_MENU_SLUGS: new Set(["internal-admin", "ops-weekly"]),
}));

const op = (over: Partial<RecipientOperator> = {}): RecipientOperator => ({
  email: "r@x",
  status: "active",
  permission: "member",
  allowed_menus: [],
  ...over,
});

describe("recipientWarning — 지정자 전용 정책", () => {
  it("allowed_menus 에 없는 member 는 no-menu, 있으면 통과, admin 은 통과", () => {
    expect(
      recipientWarning(
        op({ permission: "member", allowed_menus: ["receivables"] }),
      ),
    ).toBe("no-menu");
    expect(
      recipientWarning(
        op({ permission: "member", allowed_menus: ["ops-weekly"] }),
      ),
    ).toBeNull();
    expect(
      recipientWarning(op({ permission: "admin", allowed_menus: [] })),
    ).toBeNull();
  });
});
