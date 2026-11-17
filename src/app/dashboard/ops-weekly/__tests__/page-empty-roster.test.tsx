import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";

const view = {
  kind: "week",
  week: {
    id: "w1",
    week_start: "2026-11-16",
    duty_email: null,
    status: "open",
    reported_at: null,
  },
  weekRef: weekRefFromStart("2026-11-16"),
  tab: "application",
  actor: { email: "a@example.com", isAdmin: false },
  writers: [],
  viewed: null,
  report: null,
  snapshot: null,
  detail: null,
  kpis: null,
  submittedCount: 0,
  prevOpen: false,
  canEdit: false,
  canSubmit: false,
};

vi.mock("@/features/auth/menu-guard", () => ({
  requireMenu: async () => ({ email: "a@example.com", permission: "member" }),
}));
vi.mock("../_load", () => ({ loadOpsWeeklyPage: async () => view }));
vi.mock("../../_components/page-header/PageHeader", () => ({
  PageHeader: () => null,
}));
vi.mock("../_components/WeekHeader", () => ({ WeekHeader: () => null }));
vi.mock("@/components/common/PageTabs", () => ({ PageTabs: () => null }));

import OpsWeeklyPage from "../page";

const EMPTY_TEXT = "작성 대상 명단이 비어 있습니다 — 관리자 설정을 확인하세요";

describe("명단이 비었을 때", () => {
  it("안내 한 줄을 정확히 한 번만 그린다", async () => {
    render(await OpsWeeklyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(1);
  });

  it("빈 상태 상자(bg-situation-bg + border-line-soft) 안에 든다", async () => {
    render(await OpsWeeklyPage({ searchParams: Promise.resolve({}) }));
    const box = screen.getByText(EMPTY_TEXT).parentElement as Element;
    const t = box.className.split(/\s+/);
    expect(t).toContain("bg-situation-bg");
    expect(t).toContain("border-line-soft");
  });

  it("설정 링크는 admin 에게만 보인다", async () => {
    const { unmount } = render(
      await OpsWeeklyPage({ searchParams: Promise.resolve({}) }),
    );
    expect(screen.queryByRole("link", { name: "설정 열기" })).toBeNull();
    unmount();
    Object.assign(view, { actor: { email: "a@example.com", isAdmin: true } });
    render(await OpsWeeklyPage({ searchParams: Promise.resolve({}) }));
    expect(screen.getByRole("link", { name: "설정 열기" })).toHaveAttribute(
      "href",
      expect.stringContaining("tab=settings"),
    );
  });
});
