import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

// useDashboardRealtime mock — Realtime 구독 없이 렌더 테스트
vi.mock("../use-dashboard-realtime", () => ({
  useDashboardRealtime: () => {},
}));

import { LiveOverview, type LiveOverviewProps } from "../LiveOverview";

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: true,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: "",
      dispatchEvent: () => false,
    }),
  });
}

const baseProps: LiveOverviewProps = {
  mine: false,
  myEmail: null,
  title: "실시간 현황",
  kpi: {
    sago: { count: 3, sparklineD: "M 0,30 L 100,2" },
    todo: { count: 7, done: 2, total: 10 },
    service: { count: 5, sparklineD: "M 0,35 L 100,12" },
  },
  keyMetrics: {
    todoWeekly: { done: 2, total: 10 },
    todoProject: { done: 1, total: 3 },
    aiOutputs: 8,
    incidents: 3,
    serviceClosed: 41,
  },
  metrics: {
    contract: { value: 1, desc: "미체결 계약" },
    bond: { value: 2, active: true, desc: "미수금 내역" },
    backup: { value: 0, desc: "요청 및 내역" },
    contacts: { value: 5, desc: "등록한 연락처" },
    handover: { value: 0, desc: "등록된 인수인계" },
  },
  lifecycle: [
    {
      label: "오픈 예정",
      tag: "오픈 준비",
      count: 13,
      meta: "배포 준비 완료",
      variant: "soon",
      sparklineD: "M 0,35 L 100,12",
    },
    {
      label: "진행 중",
      tag: "작성 중",
      count: 28,
      meta: "서비스 마감 연동",
      variant: "prog",
    },
    {
      label: "마감 완료",
      tag: "마감",
      count: 41,
      meta: "이번 주 마감 6",
      variant: "done",
    },
    {
      label: "전형료 정산",
      tag: "예정",
      count: null,
      meta: "백엔드 후속",
      variant: "settle",
    },
  ],
  tableItems: [],
  healthItems: [
    { label: "Supabase Connection", tone: "ok", detail: "120ms" },
    { label: "Cron 자동화 엔진", tone: "warn", detail: "77시간 전 (지연)" },
  ],
  logLines: [],
  headline: {
    incidentsUnresolved: 1,
    deadlinesToday: 3,
    overdueReceivables: 4,
    inProgressServices: 28,
    topDeadlineLabel: "건국대 · 후기 2차",
    topIncidentLabel: "원서 작성페이지 오류",
  },
  activityLog: [],
  timelineEvents: [],
};

beforeEach(() => {
  mockReducedMotion();
  push.mockClear();
});

const handoverItem = {
  id: "h1",
  domain: "handover" as const,
  badgeDomain: "인수인계" as const,
  variant: "handover" as const,
  statusText: "작성중",
  title: "서울대 · 원서접수",
  timeText: "방금 전",
  occurredAt: new Date().toISOString(),
  refDate: "",
  triage: "track" as const,
  listRow: {
    id: "h1",
    name: "서울대 · 원서접수",
    status: "active" as const,
    owner: "test@example.com",
  },
};

describe("LiveOverview (Broadsheet)", () => {
  it("마스트헤드 + 4개 섹션 제목 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
    expect(screen.getByText("실시간 운영 로그")).toBeInTheDocument();
    expect(screen.getByText("현황 요약")).toBeInTheDocument();
    expect(screen.getByText("핵심 지표")).toBeInTheDocument();
    expect(screen.getByText("긴급도 분류")).toBeInTheDocument();
    expect(screen.getByText("우선순위 피드")).toBeInTheDocument();
  });

  it("현황 요약 — 라이프사이클/메트릭 라벨이 목록에 표시", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("계약")).toBeInTheDocument();
    expect(screen.getByText("오픈예정")).toBeInTheDocument();
    expect(screen.getByText("미수채권")).toBeInTheDocument();
    expect(screen.getByText("대학연락처")).toBeInTheDocument();
  });

  it("핵심 지표 — 주요업무/프로젝트/AI산출물/사고처리/서비스마감", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("내 할 일 · 주요업무")).toBeInTheDocument();
    expect(screen.getByText("내 할 일 · 프로젝트")).toBeInTheDocument();
    expect(screen.getByText("AI 산출물")).toBeInTheDocument();
    expect(screen.getByText("사고처리")).toBeInTheDocument();
    expect(screen.getByText("서비스 마감")).toBeInTheDocument();
  });

  it("서비스 마감 serviceClosed=null → '—'", () => {
    render(
      <LiveOverview
        {...baseProps}
        keyMetrics={{ ...baseProps.keyMetrics, serviceClosed: null }}
      />,
    );
    const row = screen.getByText("서비스 마감").closest("div") as HTMLElement;
    expect(within(row).getByText("—")).toBeInTheDocument();
  });

  it("미수채권/사고처리 라벨은 vermilion 강조", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("미수채권").className).toMatch(/text-vermilion/);
    expect(screen.getByText("사고처리").className).toMatch(/text-vermilion/);
  });

  it("AUTO 헤드라인 (urgent 모드) 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("AUTO ▸ 우선순위 자동")).toBeInTheDocument();
  });

  it("긴급도 분류 4버킷 헤더 + 빈 피드 메시지", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("지금 당장")).toBeInTheDocument();
    expect(screen.getByText("추적중")).toBeInTheDocument();
    expect(screen.getByText(/표시할 항목이 없습니다/)).toBeInTheDocument();
  });

  it("handover tableItem → 피드 칩과 제목 표시", () => {
    render(<LiveOverview {...baseProps} tableItems={[handoverItem]} />);
    expect(
      screen.getByRole("button", { name: /인수인계 1/ }),
    ).toBeInTheDocument();
    // 트리아지(track) + 피드 양쪽에 제목 노출
    expect(screen.getAllByText("서울대 · 원서접수").length).toBeGreaterThan(0);
  });

  it("피드 카드 클릭 시 인스펙터 열림", () => {
    const { container } = render(
      <LiveOverview {...baseProps} tableItems={[handoverItem]} />,
    );
    const panel = container.querySelector(
      '[role="complementary"]',
    ) as HTMLElement;
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    const titles = screen.getAllByText("서울대 · 원서접수");
    fireEvent.click(titles[titles.length - 1]);
    expect(panel.getAttribute("aria-hidden")).toBe("false");
  });

  it("mine=true + myEmail 전달 시 렌더 에러 없음", () => {
    expect(() =>
      render(
        <LiveOverview {...baseProps} mine={true} myEmail="user@example.com" />,
      ),
    ).not.toThrow();
  });
});
