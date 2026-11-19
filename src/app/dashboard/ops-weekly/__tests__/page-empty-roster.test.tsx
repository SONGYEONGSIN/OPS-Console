import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";

const state = vi.hoisted(() => ({ view: {} as Record<string, unknown> }));

function noAccess(emptyRoster: boolean) {
  return {
    kind: "no-access",
    week: {
      id: "w1",
      week_start: "2026-11-16",
      duty_email: null,
      status: "open",
      reported_at: null,
    },
    weekRef: weekRefFromStart("2026-11-16"),
    emptyRoster,
  };
}

vi.mock("@/features/auth/menu-guard", () => ({
  requireMenu: async () => ({ email: "a@example.com", permission: "member" }),
}));
vi.mock("../_load", () => ({ loadOpsWeeklyPage: async () => state.view }));
vi.mock("../../_components/page-header/PageHeader", () => ({
  PageHeader: () => null,
}));
vi.mock("../_components/WeekHeader", () => ({ WeekHeader: () => null }));
vi.mock("@/components/common/PageTabs", () => ({ PageTabs: () => null }));

import OpsWeeklyPage from "../page";

const EMPTY_TEXT = "작성 대상 명단이 비어 있습니다 — 관리자 설정을 확인하세요";
const NO_ACCESS_TEXT = "이 주에 볼 수 있는 화면이 없습니다";
const GUIDE_TEXT =
  "주간업무보고는 작성 대상과 그 주 당번·관리자가 봅니다. 받는 사람은 보고가 끝난 주를 볼 수 있습니다.";

const renderPage = async () =>
  render(await OpsWeeklyPage({ searchParams: Promise.resolve({}) }));

afterEach(cleanup);

describe("안내 화면 — 명단이 비었을 때", () => {
  it("안내 한 줄을 정확히 한 번만 그린다", async () => {
    state.view = noAccess(true);
    await renderPage();
    expect(screen.getAllByText(EMPTY_TEXT)).toHaveLength(1);
    expect(screen.queryByText(GUIDE_TEXT)).toBeNull();
  });

  it("빈 상태 상자(bg-situation-bg + border-line-soft) 안에 든다", async () => {
    state.view = noAccess(true);
    await renderPage();
    const box = screen.getByText(EMPTY_TEXT).parentElement as Element;
    const t = box.className.split(/\s+/);
    expect(t).toContain("bg-situation-bg");
    expect(t).toContain("border-line-soft");
  });

  it("관리(설정)로 가는 링크가 없다 — 관리자는 안내 화면에 오지 않는다", async () => {
    state.view = noAccess(true);
    await renderPage();
    expect(screen.queryByRole("link", { name: "설정 열기" })).toBeNull();
    for (const a of screen.queryAllByRole("link")) {
      expect(a.getAttribute("href")).not.toContain("tab=settings");
    }
  });
});

describe("안내 화면 — 볼 수 있는 화면이 없을 때", () => {
  it("문구·안내 줄·주 이동 링크", async () => {
    state.view = noAccess(false);
    await renderPage();
    const box = screen.getByText(NO_ACCESS_TEXT).parentElement as Element;
    expect(box.className.split(/\s+/)).toContain("bg-situation-bg");
    const guide = screen.getByText(GUIDE_TEXT);
    expect(guide.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["text-xs", "text-muted"]),
    );
    expect(screen.queryByText(EMPTY_TEXT)).toBeNull();
    expect(screen.getByRole("link", { name: "‹ 이전 주" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-09&tab=status",
    );
    expect(screen.getByRole("link", { name: "다음 주 ›" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-23&tab=status",
    );
    expect(screen.getByRole("link", { name: "이번 주로" })).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly",
    );
  });
});
