import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

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
};

beforeEach(() => {
  mockReducedMotion();
  push.mockClear();
});

describe("LiveOverview (Phase 3 — Realtime)", () => {
  it("헤더 + 라이프사이클 파이프 + 통합 그룹박스 + 필터 + 테이블 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    // 헤더 — 커맨드 바 마스트헤드
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
    // 라이프사이클 4 스테이지 label (KpiCardLarge → LifecyclePipe 교체)
    expect(screen.getByText("오픈 예정")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("마감 완료")).toBeInTheDocument();
    expect(screen.getByText("전형료 정산")).toBeInTheDocument();
    // 옛 KPI 대형 카드 label은 더 이상 렌더되지 않음
    expect(screen.queryByText("사고 누적 데이터")).toBeNull();
    expect(screen.queryByText("내 미완 할 일")).toBeNull();
    // 그룹박스 title (PR②에서 유지)
    expect(screen.getByText("서비스 현황")).toBeInTheDocument();
    expect(screen.queryByText("계약 · 미수채권")).toBeNull();
    expect(screen.queryByText("백업 · 인수인계 · 연락처")).toBeNull();
    // 필터 (FilterTabs의 '전체' 칩 — 뒤에 (건수)가 붙음)
    expect(
      screen.getByRole("button", { name: /^전체 \(\d/ }),
    ).toBeInTheDocument();
    // 빈 테이블 empty 메시지
    expect(screen.getByText(/표시할 항목이 없습니다/)).toBeInTheDocument();
  });

  it("라이프사이클 스테이지 사이에 화살표가 렌더됨", () => {
    const { container } = render(<LiveOverview {...baseProps} />);
    // 4 스테이지 → 화살표 3개
    expect(container.querySelectorAll("[data-pipe-arrow]").length).toBe(3);
  });

  it("settle 스테이지 count=null → '—' 셸 표시", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("미수 채권 active=true → vermilion (subcard-value)", () => {
    const { container } = render(<LiveOverview {...baseProps} />);
    const bondValue = Array.from(
      container.querySelectorAll("[data-subcard-value]"),
    ).find((el) => el.textContent === "2") as HTMLElement | undefined;
    expect(bondValue?.className).toMatch(/text-vermilion/);
  });

  it("필터 칩 클릭 시 칩 active 전환 (굵게 + 밑줄)", () => {
    render(<LiveOverview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /^사고/ }));
    const tab = screen.getByRole("button", { name: /^사고/ });
    expect(tab.className).toMatch(/font-bold/);
    expect(tab.querySelector("span[aria-hidden]")?.className).toMatch(
      /bg-vermilion/,
    );
  });

  it("필터링 결과 카운트 텍스트 표시", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText(/0건 표시 중/)).toBeInTheDocument();
  });

  it("커맨드 바 렌더 (마스트헤드 + 시스템 날씨 게이트웨이)", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("운영부 상황실")).toBeInTheDocument();
    expect(screen.getByText("시스템 날씨")).toBeInTheDocument();
    // healthItems에 warn(Cron 지연) 1건 → 요약에 "1 지연"
    expect(screen.getByText(/맑음 · 1 지연/)).toBeInTheDocument();
    // AdminControls 버튼 없음
    expect(
      screen.queryByRole("button", { name: /실시간 스트림 활성화/ }),
    ).toBeNull();
  });

  it("logLines 전달 시 티커에 로그 본문이 표시됨", () => {
    const seedLines = [
      { text: "[HANDOVER] 인수인계 등록 완료", type: "info" as const },
      { text: "[INCIDENTS] 장애 발생", type: "err" as const },
    ];
    render(<LiveOverview {...baseProps} logLines={seedLines} />);
    // LogTicker는 "[TAG] 본문"에서 선행 태그를 분리 — 본문 텍스트로 확인
    expect(screen.getAllByText("인수인계 등록 완료").length).toBeGreaterThan(0);
    expect(screen.getAllByText("장애 발생").length).toBeGreaterThan(0);
  });

  it("mine=true + myEmail 전달 시 렌더 에러 없음", () => {
    expect(() =>
      render(
        <LiveOverview {...baseProps} mine={true} myEmail="user@example.com" />,
      ),
    ).not.toThrow();
  });

  it("인수인계 서브카드가 그룹박스 안에 렌더됨", () => {
    render(<LiveOverview {...baseProps} />);
    // "인수인계"는 MetricSubcard 레이블 + FilterTabs 칩에 동시에 존재하므로 getAllByText
    expect(screen.getAllByText("인수인계").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("등록된 인수인계")).toBeInTheDocument();
  });

  it("인수인계 필터 칩이 FilterTabs에 렌더됨", () => {
    render(<LiveOverview {...baseProps} />);
    expect(
      screen.getByRole("button", { name: /^인수인계 \(\d/ }),
    ).toBeInTheDocument();
  });

  it("handover 도메인 tableItems 카운트가 인수인계 칩에 반영됨", () => {
    const handoverItem = {
      id: "h1",
      domain: "handover" as const,
      badgeDomain: "인수인계" as const,
      variant: "handover" as const,
      statusText: "published",
      title: "서울대 · 원서접수",
      timeText: "방금 전",
      occurredAt: new Date().toISOString(),
      listRow: {
        id: "h1",
        name: "서울대 · 원서접수",
        status: "active" as const,
        owner: "test@example.com",
      },
    };
    render(<LiveOverview {...baseProps} tableItems={[handoverItem]} />);
    expect(
      screen.getByRole("button", { name: /^인수인계 \(1\)/ }),
    ).toBeInTheDocument();
  });
});
