import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";

const state = vi.hoisted(() => ({ view: {} as Record<string, unknown> }));

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

function viewFor(tab: string, over: Record<string, unknown> = {}) {
  return {
    kind: "week",
    week: {
      id: "w1",
      week_start: "2026-11-16",
      duty_email: null,
      status: "open",
      reported_at: null,
    },
    weekRef: weekRefFromStart("2026-11-16"),
    tab,
    actor: { email: "a@example.com", isAdmin: true },
    writers: [{ email: "a@example.com", name: "홍길동" }],
    viewed: { email: "a@example.com", name: "홍길동" },
    all: null,
    report: null,
    snapshot: null,
    detail: null,
    kpis: { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6, scoreCalc: null, leave: 6 },
    submittedCount: 0,
    prevOpen: false,
    canEdit: false,
    canSubmit: false,
    reports: null,
    projectGroups: null,
    finalize: null,
    bundle: null,
    roles: ["report"],
    statusAccess: null,
    ...over,
  };
}

describe("KPI 는 내 보고서에서만 — 누구의 숫자인지 밝힌다", () => {
  it.each(["application", "pims", "project"])("%s 탭", async (tab) => {
    state.view = viewFor(tab);
    const { unmount } = render(
      await OpsWeeklyPage({ searchParams: Promise.resolve({ tab }) }),
    );
    expect(screen.getAllByTestId("weekly-kpi-label")).toHaveLength(8);
    expect(screen.getByText(/^홍길동의 이번 주/)).toBeInTheDocument();
    unmount();
  });

  // 0장은 이 픽스처의 kpis: null 에서 나온다 — 제출 현황·관리에서 KPI 를 안 읽는 것은
  // 로더 몫이고 load-access.test 가 지킨다. 여기서는 kpis 가 없을 때 페이지가 카드를 안 그리는 것만 본다.
  it.each(["status", "settings"])(
    "%s 탭: kpis 가 없으면 카드 없음",
    async (tab) => {
      state.view = viewFor(tab, { kpis: null });
      const { unmount } = render(
        await OpsWeeklyPage({ searchParams: Promise.resolve({ tab }) }),
      );
      expect(screen.queryAllByTestId("weekly-kpi-label")).toHaveLength(0);
      expect(screen.queryByText(/^홍길동의 이번 주/)).toBeNull();
      unmount();
    },
  );
});
