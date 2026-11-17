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

function viewFor(tab: string) {
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
    report: null,
    snapshot: null,
    detail: null,
    kpis: { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6 },
    submittedCount: 0,
    prevOpen: false,
    canEdit: false,
    canSubmit: false,
    reports: null,
    projectGroups: null,
    finalize: null,
    bundle: null,
  };
}

describe("KPI 카드는 모든 탭에서 보이고 누구의 숫자인지 밝힌다", () => {
  it.each(["application", "pims", "project", "status", "settings"])(
    "%s 탭",
    async (tab) => {
      state.view = viewFor(tab);
      const { unmount } = render(
        await OpsWeeklyPage({ searchParams: Promise.resolve({ tab }) }),
      );
      expect(screen.getAllByTestId("weekly-kpi-label")).toHaveLength(6);
      expect(screen.getByText(/^홍길동의 이번 주/)).toBeInTheDocument();
      unmount();
    },
  );
});
