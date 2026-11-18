import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { weekRefFromStart } from "@/features/ops-weekly/week";
import { EMPTY, snap } from "./tab-fixtures";

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
vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: vi.fn(),
  removeManualItem: vi.fn(),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));
vi.mock("@/features/ops-weekly/settings-actions", () => ({
  addRecipient: vi.fn(),
  removeRecipient: vi.fn(),
  saveRotation: vi.fn(),
  saveExcludedWriters: vi.fn(),
  upsertProject: vi.fn(),
  setProjectOwners: vi.fn(),
}));
vi.mock(
  "next/navigation",
  async () => (await import("./search-params-mock")).navigationModule,
);

import OpsWeeklyPage from "../page";
import { setUrl } from "./search-params-mock";

function viewFor(tab: string, isAdmin: boolean, over = {}) {
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
    actor: { email: "a@example.com", isAdmin },
    writers: [{ email: "a@example.com", name: "홍길동" }],
    viewed: { email: "a@example.com", name: "홍길동" },
    report: { id: "r1", status: "draft", checked_tabs: [], snapshot: null },
    snapshot: snap({ unmatchedApplication: 3, unmatchedPims: 2 }),
    detail: EMPTY,
    kpis: { dev: 1, test: 2, opening: 3, running: 4, closing: 5, pims: 6 },
    submittedCount: 0,
    prevOpen: false,
    freezeNotice: false,
    canEdit: true,
    canSubmit: true,
    reports: null,
    projectGroups: null,
    finalize: null,
    bundle: null,
    unmatched: null,
    ...over,
  };
}

const kpiCard = (label: string) =>
  screen
    .getAllByTestId("weekly-kpi-label")
    .find((n) => n.textContent === label)
    ?.closest("a");

const renderPage = async (tab: string) =>
  render(await OpsWeeklyPage({ searchParams: Promise.resolve({ tab }) }));

beforeEach(() => {
  setUrl("?week=2026-11-16&tab=application");
});
afterEach(cleanup);

describe("주간업무보고 페이지 — 하위 탭·KPI 고정", () => {
  it("KPI 줄은 lg 이상에서 붙는 막대 안에 있고 카드는 링크다", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    const bar = screen.getByText(/^홍길동의 이번 주/).parentElement as Element;
    expect(bar.className).toContain("lg:sticky");
    expect(bar.className).toContain("bg-paper");
    expect(screen.getAllByTestId("weekly-kpi-label")).toHaveLength(6);
    expect(kpiCard("운영 중")?.getAttribute("href")).toBe(
      "/dashboard/ops-weekly?week=2026-11-16&tab=application&sub=running",
    );
  });

  it("남의 보고서를 보는 중이면 카드 링크가 op 를 유지한다", async () => {
    state.view = viewFor("application", true, {
      writers: [
        { email: "a@example.com", name: "홍길동" },
        { email: "b@example.com", name: "김철수" },
      ],
      viewed: { email: "b@example.com", name: "김철수" },
    });
    await renderPage("application");
    expect(kpiCard("운영 중")?.getAttribute("href")).toContain(
      "&op=b%40example.com&sub=running",
    );
  });

  it("원서접수 탭: 비관리자에게는 안 붙은 서비스 안내가 없다", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    expect(screen.queryByText(/안 붙은 서비스/)).toBeNull();
    expect(screen.queryByText("설정에서 목록 보기")).toBeNull();
  });

  it("원서접수 탭: 관리자는 안내와 설정 패널 링크가 보인다", async () => {
    state.view = viewFor("application", true);
    await renderPage("application");
    expect(
      screen.getByText(/안 붙은 서비스 3건 — 서비스 마감 메뉴/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "설정에서 목록 보기" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=settings#unmatched",
    );
  });

  it("PIMS 탭: 관리자만 안내, 하위 탭은 금주·차주", async () => {
    state.view = viewFor("pims", false);
    const { unmount } = await renderPage("pims");
    expect(screen.queryByText(/안 붙은 발표 서비스/)).toBeNull();
    expect(
      within(screen.getByRole("tablist", { name: "PIMS 묶음" })).getAllByRole(
        "tab",
      ),
    ).toHaveLength(2);
    unmount();
    state.view = viewFor("pims", true);
    await renderPage("pims");
    expect(screen.getByText(/안 붙은 발표 서비스 2건/)).toBeInTheDocument();
  });

  it("설정 탭: 안 붙은 서비스 패널이 목록으로 그려진다", async () => {
    state.view = viewFor("settings", true, {
      snapshot: null,
      detail: null,
      bundle: {
        recipients: [],
        rotation: [],
        anchorWeekStart: null,
        excludedWriterEmails: [],
        writerCandidates: [],
        projects: [],
      },
      unmatched: {
        application: [
          {
            service_id: 1,
            university_name: "대학1",
            service_name: "서비스1",
            operator_name: "퇴사자",
            write_start_at: "2026-11-23T00:00:00Z",
            write_end_at: "2026-12-10T00:00:00Z",
            pay_end_at: null,
          },
        ],
        pims: [],
      },
    });
    await renderPage("settings");
    const region = screen.getByRole("region", { name: "안 붙은 서비스" });
    expect(
      within(region).getByRole("heading", { name: "원서접수 1건" }),
    ).toBeInTheDocument();
    expect(within(region).getByText("대학1")).toBeInTheDocument();
  });
});
