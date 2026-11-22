import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";
import { EMPTY, item, snap } from "./tab-fixtures";

const state = vi.hoisted(() => ({
  view: {} as Record<string, unknown>,
  header: {} as Record<string, unknown>,
}));

vi.mock("@/features/auth/menu-guard", () => ({
  requireMenu: async () => ({ email: "a@example.com", permission: "member" }),
}));
vi.mock("../_load", () => ({ loadOpsWeeklyPage: async () => state.view }));
vi.mock("../../_components/page-header/PageHeader", () => ({
  PageHeader: () => null,
}));
vi.mock("../_components/WeekHeader", () => ({
  WeekHeader: (p: Record<string, unknown>) => {
    state.header = p;
    return null;
  },
}));
vi.mock("@/components/common/PageTabs", () => ({
  PageTabs: (p: { active: string }) => <div data-testid="role-tabs" data-active={p.active} />,
}));
vi.mock("next/navigation", async () => ({
  ...(await import("./search-params-mock")).navigationModule,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

import OpsWeeklyPage from "../page";

const KPIS = { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6 };

function allView(over: Record<string, unknown> = {}) {
  const base = snap();
  const snapshot = {
    ...base,
    application: {
      ...base.application,
      running: [{ ...item("closing:1"), owners: ["홍길동", "김철수"] }],
    },
  };
  return {
    kind: "week",
    week: { id: "w1", week_start: "2026-11-16", duty_email: null, status: "open", reported_at: null },
    weekRef: weekRefFromStart("2026-11-16"),
    tab: "application",
    actor: { email: "a@example.com", isAdmin: false },
    writers: [
      { email: "a@example.com", name: "홍길동" },
      { email: "b@example.com", name: "김철수" },
    ],
    viewed: null,
    all: {
      snapshot,
      detail: EMPTY,
      notes: {
        application: [{ name: "김철수", thisWeek: "연장 접수", nextWeek: "" }],
        pims: [],
        leave: [],
        project: [],
        tf: [],
      },
      kpis: KPIS,
    },
    report: null,
    snapshot,
    detail: EMPTY,
    kpis: KPIS,
    freezeNotice: false,
    submittedCount: 0,
    prevOpen: false,
    canEdit: false,
    canSubmit: false,
    reports: null,
    projectGroups: null,
    finalize: null,
    bundle: null,
    unmatched: null,
    overview: null,
    roles: ["report"],
    statusAccess: null,
    ...over,
  };
}

async function renderPage(view: Record<string, unknown>) {
  state.view = view;
  return render(
    await OpsWeeklyPage({ searchParams: Promise.resolve({ op: "all" }) }),
  );
}

describe("전체 보고 화면", () => {
  it("KPI 는 작성자 전원의 숫자, 표에 담당자, 쓸 칸 대신 사람별 특이사항, 제출 버튼 없음", async () => {
    await renderPage(allView());
    expect(screen.getByText(/^작성자 전원의 이번 주/)).toBeInTheDocument();
    expect(screen.getAllByText("홍길동, 김철수").length).toBeGreaterThan(0);
    const notes = screen.getAllByRole("region", { name: "원서접수 특이사항", hidden: true })[0];
    expect(within(notes).getByText("연장 접수")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByRole("heading", { name: "프로젝트·TF 모아보기" })).toBeInTheDocument();
  });

  it("머리띠 토글은 전체가 켜지고, 작성자면 내 보고도 있다", async () => {
    await renderPage(allView());
    expect(state.header.scope).toEqual({ mine: true, mineOp: null, active: "all" });
  });

  it("명단 밖 관리자가 보면 내 보고는 없고 역할 탭은 제출 현황이 켜진다", async () => {
    await renderPage(
      allView({
        actor: { email: "z@example.com", isAdmin: true },
        roles: ["status", "manage"],
        statusAccess: "manage",
      }),
    );
    expect(state.header.scope).toEqual({ mine: false, mineOp: null, active: "all" });
    expect(screen.getByTestId("role-tabs")).toHaveAttribute("data-active", "status");
  });
});
