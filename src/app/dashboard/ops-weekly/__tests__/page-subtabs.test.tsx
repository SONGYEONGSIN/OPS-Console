import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  within,
  fireEvent,
} from "@testing-library/react";
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
vi.mock("../_components/WeekHeader", () => ({
  WeekHeader: (p: {
    week: unknown;
    viewingOther: unknown;
    writerPicker: unknown;
    dutyName: string | null;
  }) => (
    <div
      data-testid="week-header"
      data-duty={p.dutyName ?? "(null)"}
      data-picker={p.writerPicker === null ? "none" : "shown"}
      data-week={JSON.stringify(p.week)}
      data-other={JSON.stringify(p.viewingOther)}
    />
  ),
}));
vi.mock("@/components/common/PageTabs", () => ({
  PageTabs: ({
    tabs,
    active,
    size,
    className,
  }: {
    tabs: { key: string; label: string; href: string }[];
    active: string;
    size?: string;
    className?: string;
  }) => (
    <nav
      data-testid={
        tabs.some((t) => ["report", "status", "manage"].includes(t.key))
          ? "role-tabs"
          : "area-tabs"
      }
      data-active={active}
      data-size={size}
      className={className}
    >
      {tabs.map((t) => (
        <a key={t.key} href={t.href}>
          {t.label}
        </a>
      ))}
    </nav>
  ),
}));
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
    roles: ["report"],
    statusAccess: null,
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
    expect(screen.queryByText("관리에서 목록 보기")).toBeNull();
  });

  it("원서접수 탭: 관리자는 안내와 설정 패널 링크가 보인다", async () => {
    state.view = viewFor("application", true);
    await renderPage("application");
    expect(
      screen.getByText(/안 붙은 서비스 3건 — 서비스마감 메뉴/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "관리에서 목록 보기" }),
    ).toHaveAttribute(
      "href",
      "/dashboard/ops-weekly?week=2026-11-16&tab=settings&section=unmatched",
    );
  });

  it("PIMS 탭: 관리자만 안내, 하위 탭은 금주·차주", async () => {
    setUrl("?week=2026-11-16&tab=pims");
    state.view = viewFor("pims", false);
    const { unmount } = await renderPage("pims");
    expect(screen.queryByText(/안 붙은 발표 서비스/)).toBeNull();
    expect(
      within(screen.getByRole("tablist", { name: "합격자 발표 묶음" })).getAllByRole(
        "tab",
      ),
    ).toHaveLength(2);
    unmount();
    state.view = viewFor("pims", true);
    await renderPage("pims");
    expect(screen.getByText(/안 붙은 발표 서비스 2건/)).toBeInTheDocument();
  });

  it("원서접수: 영역 탭·쓸 것 패널, 특이사항 셋이 모두 마운트된다", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    expect(screen.getByRole("tablist", { name: "영역" })).toBeInTheDocument();
    const panel = screen.getByRole("complementary", { name: "쓸 것" });
    // 패널 안으로 좁힌다 — T17 의 서랍(ProjectTab 둘)도 AreaNotes 를 마운트해 화면 전체로는 다섯이 된다
    expect(
      within(panel).getAllByRole("heading", {
        name: "영역 특이사항",
        hidden: true,
      }),
    ).toHaveLength(3);
  });

  it("설정 탭: 안 붙은 서비스 패널이 목록으로 그려진다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=unmatched");
    state.view = viewFor("settings", true, {
      overview: [],
      snapshot: null,
      detail: null,
      bundle: {
        recipients: [],
        rotation: [],
        anchorWeekStart: null,
        excludedWriterEmails: [],
        writerCandidates: [],
        recipientCandidates: [],
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
    const region = screen.getByRole("region", { name: "지정 안된 서비스" });
    expect(
      within(region).getByRole("heading", { name: "원서접수 1건" }),
    ).toBeInTheDocument();
    expect(within(region).getByText("대학1")).toBeInTheDocument();
  });

  it("tab=project: 서랍이 열리고 왼쪽은 원서접수, 프로젝트 제목은 서랍 머리 하나", async () => {
    setUrl("?week=2026-11-16&tab=project");
    state.view = viewFor("project", false);
    await renderPage("project");
    // 서랍 안 ProjectTab 은 hideHeading, 요약 카드 이름은 제목 요소가 아니다
    const titles = screen.getAllByRole("heading", { name: "프로젝트" });
    expect(titles).toHaveLength(1);
    expect(titles[0].closest("aside")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("tab", { name: "원서접수" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("[쓰기]로 연 서랍은 합격자 발표 KPI 카드를 누르면(키보드) 닫힌다 — KPI 줄과 서랍이 같은 Provider 아래", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    const opener = screen.getByRole("button", { name: "프로젝트 쓰기" });
    fireEvent.click(opener);
    const aside = screen
      .getByRole("heading", { name: "프로젝트" })
      .closest("aside");
    expect(aside).toHaveAttribute("aria-hidden", "false");

    // click 만 — mousedown 은 InspectorPanel 의 바깥 클릭이 혼자 닫아서 배선을 못 가린다(키보드 경로).
    fireEvent.click(kpiCard("합격자 발표") as HTMLElement);

    expect(aside).toHaveAttribute("aria-hidden", "true");
    expect(aside?.querySelector("[inert]")).not.toBeNull();
  });

  it("서랍을 연 채 제출 현황에 갔다 오면 닫혀 있다 — Provider 가 역할 key 로 다시 마운트된다", async () => {
    state.view = viewFor("application", false);
    const { rerender } = await renderPage("application");
    fireEvent.click(screen.getByRole("button", { name: "프로젝트 쓰기" }));
    expect(
      screen.getByRole("heading", { name: "프로젝트" }).closest("aside"),
    ).toHaveAttribute("aria-hidden", "false");

    // 같은 보고서(r1)라 PendingSavesProvider 는 그대로 — 갈리는 것은 역할 key 뿐이다.
    state.view = viewFor("status", false);
    rerender(
      await OpsWeeklyPage({ searchParams: Promise.resolve({ tab: "status" }) }),
    );
    state.view = viewFor("application", false);
    rerender(
      await OpsWeeklyPage({
        searchParams: Promise.resolve({ tab: "application" }),
      }),
    );

    const aside = screen
      .getByRole("heading", { name: "프로젝트", hidden: true })
      .closest("aside");
    expect(aside).toHaveAttribute("aria-hidden", "true");
    expect(aside?.querySelector("[inert]")).not.toBeNull();
  });

  it("구분 수집 전 주: KPI 카드와 하위 탭이 같은 기본(운영 중)을 가리킨다", async () => {
    state.view = viewFor("application", false, {
      snapshot: snap({ devStatusCollected: false }),
    });
    await renderPage("application");
    expect(kpiCard("운영 중")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("tab", { name: /운영 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("sub=unknown 인데 그 탭이 안 보이면 둘 다 개발 중이 활성", async () => {
    setUrl("?week=2026-11-16&tab=application&sub=unknown");
    state.view = viewFor("application", false);
    await renderPage("application");
    expect(kpiCard("개발 중")).toHaveAttribute("aria-current", "true");
    expect(screen.getByRole("tab", { name: /개발 중/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
  });

  it("설정 탭에서 안 붙은 서비스를 못 읽었으면(null) 불러오지 않았다고 적는다", async () => {
    setUrl("?week=2026-11-16&tab=settings&section=unmatched");
    state.view = viewFor("settings", true, {
      overview: [],
      snapshot: null,
      detail: null,
      bundle: {
        recipients: [],
        rotation: [],
        anchorWeekStart: null,
        excludedWriterEmails: [],
        writerCandidates: [],
        recipientCandidates: [],
        projects: [],
      },
      unmatched: null,
    });
    await renderPage("settings");
    expect(screen.getByText("목록을 불러오지 않았습니다")).toBeInTheDocument();
  });
});

describe("주간업무보고 페이지 — 직접 추가", () => {
  it("쓸 수 있는 보고서면 쓸 것 패널에 직접 추가 칸이 있다", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    const panel = screen.getByRole("complementary", { name: "쓸 것" });
    expect(within(panel).getByRole("region", { name: "직접 추가" })).toBeInTheDocument();
    expect(screen.getAllByLabelText("직접 추가 제목", { selector: "input" }).length).toBeGreaterThan(0);
  });

  it("읽기 전용(canEdit=false)이면 직접 추가 칸이 없다", async () => {
    state.view = viewFor("application", false, { canEdit: false });
    await renderPage("application");
    const panel = screen.getByRole("complementary", { name: "쓸 것" });
    expect(within(panel).queryByRole("region", { name: "직접 추가" })).toBeNull();
    expect(screen.queryByLabelText("직접 추가 제목")).toBeNull();
  });
});

describe("주간업무보고 페이지 — 제출", () => {
  it("제출완료 는 정확히 하나 — 쓸 것 패널 안", async () => {
    state.view = viewFor("application", false);
    await renderPage("application");
    const buttons = screen.getAllByRole("button", { name: "제출완료" });
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest("aside")).toHaveAccessibleName("쓸 것");
  });

  it("남의 보고서(op)에서는 제출완료 가 없다", async () => {
    state.view = viewFor("application", true, {
      statusAccess: "manage",
      writers: [
        { email: "a@example.com", name: "홍길동" },
        { email: "b@example.com", name: "김철수" },
      ],
      viewed: { email: "b@example.com", name: "김철수" },
    });
    await renderPage("application");
    expect(screen.queryByRole("button", { name: "제출완료" })).toBeNull();
  });
});

describe("주간업무보고 페이지 — 머리띠", () => {
  const OTHER = {
    writers: [
      { email: "a@example.com", name: "홍길동" },
      { email: "b@example.com", name: "김철수" },
    ],
    viewed: { email: "b@example.com", name: "김철수" },
    statusAccess: "manage",
  };
  const otherOf = () =>
    JSON.parse(screen.getByTestId("week-header").dataset.other ?? "null");

  it("머리띠 week 는 세 칸만 — 당번 총평이 실리지 않는다", async () => {
    state.view = viewFor("application", false);
    (state.view.week as Record<string, unknown>).summary_this = "총평";
    (state.view.week as Record<string, unknown>).summary_next = "차주 총평";
    await renderPage("application");
    const week = JSON.parse(screen.getByTestId("week-header").dataset.week ?? "{}");
    expect(Object.keys(week).sort()).toEqual(["reported_at", "status", "week_start"]);
  });

  it("남의 보고서면 머리띠가 그 사람 이름과 제출 현황 주소를 받는다 — 본인 보고서면 null", async () => {
    state.view = viewFor("application", false, OTHER);
    const { unmount } = await renderPage("application");
    expect(otherOf()).toEqual({
      name: "김철수",
      backHref: "/dashboard/ops-weekly?week=2026-11-16&tab=status",
    });
    unmount();
    state.view = viewFor("application", false);
    await renderPage("application");
    expect(screen.getByTestId("week-header").dataset.other).toBe("null");
  });

  it("작성자 선택 상자는 남의 보고서를 열 수 있는 사람에게만 — 일반 운영자 none, 당번·관리자(manage)·받는 사람(read) shown", async () => {
    for (const [statusAccess, want] of [
      [null, "none"],
      ["manage", "shown"],
      ["read", "shown"],
    ] as const) {
      state.view = viewFor("application", false, { statusAccess });
      const { unmount } = await renderPage("application");
      expect(screen.getByTestId("week-header").dataset.picker).toBe(want);
      unmount();
    }
  });

  it("작성 대상 명단이 비었으면 권한이 있어도 선택 상자는 없다 — 빈 선택 상자를 안 그린다", async () => {
    state.view = viewFor("application", true, {
      statusAccess: "manage",
      writers: [],
    });
    await renderPage("application");
    expect(screen.getByTestId("week-header").dataset.picker).toBe("none");
  });

  it("일반 운영자 화면에 당번 총평 문구가 없다 — 머리띠에는 세 칸만 넘어간다", async () => {
    state.view = viewFor("application", false, {
      week: {
        id: "w1",
        week_start: "2026-11-16",
        duty_email: null,
        status: "open",
        reported_at: null,
        summary_this: "총평금주문구",
        summary_next: "총평차주문구",
      },
    });
    const { container } = await renderPage("application");
    expect(
      JSON.parse(screen.getByTestId("week-header").dataset.week ?? "null"),
    ).toEqual({ week_start: "2026-11-16", status: "open", reported_at: null });
    expect(container.innerHTML).not.toContain("총평금주문구");
    expect(container.innerHTML).not.toContain("총평차주문구");
  });

  it("머리띠 당번 — 명단 이름(대소문자 무시) → 명단 밖이면 이메일 → 없으면 미지정", async () => {
    for (const [duty_email, want] of [
      ["A@example.com", "홍길동"],
      ["x@x", "x@x"],
      [null, "미지정"],
    ] as const) {
      const base = viewFor("application", false);
      state.view = { ...base, week: { ...base.week, duty_email } };
      const { unmount } = await renderPage("application");
      expect(screen.getByTestId("week-header").dataset.duty).toBe(want);
      unmount();
    }
  });

  it("예전 주소(tab=settings&op=…)로 열어도 관리 화면 머리띠에 남의 보고서 표시가 붙지 않는다", async () => {
    state.view = viewFor("settings", true, OTHER);
    await renderPage("settings");
    expect(screen.getByTestId("week-header").dataset.other).toBe("null");
  });
});

describe("역할 탭 줄", () => {
  const ALL = ["report", "status", "manage"];
  const names = (nav: HTMLElement) =>
    within(nav)
      .getAllByRole("link")
      .map((a) => a.textContent);
  const B = { email: "b@example.com", name: "김철수" };

  it("일반 운영자에게는 탭 줄이 없고 영역 탭(AreaTabs)만", async () => {
    state.view = viewFor("application", false, { roles: ["report"] });
    await renderPage("application");
    expect(screen.queryByTestId("role-tabs")).toBeNull();
    expect(screen.queryByTestId("area-tabs")).toBeNull();
    expect(screen.getByRole("tablist", { name: "영역" })).toBeInTheDocument();
  });
  it("작성자 관리자: 내 보고서·제출 현황·관리가 머리띠 위, 영역 탭(AreaTabs)은 머리띠 아래", async () => {
    state.view = viewFor("application", true, { roles: ALL });
    await renderPage("application");
    const nav = screen.getByTestId("role-tabs");
    expect(names(nav)).toEqual(["내 보고서", "제출 현황", "관리"]);
    expect(nav.dataset.active).toBe("report");
    expect(nav.dataset.size).toBe("md");
    expect(nav.className.split(/\s+/).sort()).toEqual(
      ["lg:px-7", "pt-4", "px-5"],
    );
    const header = screen.getByTestId("week-header");
    expect(
      nav.compareDocumentPosition(header) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      header.compareDocumentPosition(screen.getByRole("tablist", { name: "영역" })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
  it("제출 현황·관리에서는 그 역할 탭이 켜진다", async () => {
    for (const [tab, active] of [
      ["status", "status"],
      ["settings", "manage"],
    ] as const) {
      state.view = viewFor(tab, true, { roles: ALL });
      const { unmount } = await renderPage(tab);
      expect(screen.getByTestId("role-tabs").dataset.active).toBe(active);
      expect(screen.queryByRole("tablist", { name: "영역" })).toBeNull();
      unmount();
    }
  });
  it("남의 보고서를 볼 때는 제출 현황이 켜져 보인다", async () => {
    state.view = viewFor("application", false, {
      roles: ["report", "status"],
      writers: [{ email: "a@example.com", name: "홍길동" }, B],
      viewed: B,
    });
    await renderPage("application");
    expect(screen.getByTestId("role-tabs").dataset.active).toBe("status");
  });
  it("예전 주소 ?tab=settings&op=… 로 열면 관리가 켜져 있다", async () => {
    state.view = viewFor("settings", true, {
      roles: ALL,
      writers: [{ email: "a@example.com", name: "홍길동" }, B],
      viewed: B,
    });
    await renderPage("settings");
    expect(screen.getByTestId("role-tabs").dataset.active).toBe("manage");
  });
  it("명단 밖 관리자가 ?op=작성자 로 열면 탭은 제출 현황·관리 둘이고 제출 현황이 켜져 있다", async () => {
    state.view = viewFor("application", true, {
      actor: { email: "z@example.com", isAdmin: true },
      roles: ["status", "manage"],
      statusAccess: "manage",
      viewed: { email: "a@example.com", name: "홍길동" },
    });
    await renderPage("application");
    const nav = screen.getByTestId("role-tabs");
    expect(names(nav)).toEqual(["제출 현황", "관리"]);
    expect(nav.dataset.active).toBe("status");
  });
});
