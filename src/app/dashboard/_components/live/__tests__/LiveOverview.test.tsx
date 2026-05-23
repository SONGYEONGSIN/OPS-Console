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
    scheduleActivity: { value: 0, desc: "예정 일정" },
  },
  tableItems: [],
};

beforeEach(() => {
  mockReducedMotion();
  push.mockClear();
});

describe("LiveOverview (Phase 3 — Realtime)", () => {
  it("헤더 + 3 KPI 카드 + 2 그룹박스 + 필터 + 테이블 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    // 헤더
    expect(screen.getByText("실시간 현황")).toBeInTheDocument();
    // KPI 3 카드 label
    expect(screen.getByText("사고 누적 데이터")).toBeInTheDocument();
    expect(screen.getByText("내 미완 할 일")).toBeInTheDocument();
    expect(screen.getByText("오픈 예정 서비스")).toBeInTheDocument();
    // 그룹박스 title
    expect(screen.getByText("계약 · 미수채권")).toBeInTheDocument();
    expect(screen.getByText("백업 · 연락처 · 일정")).toBeInTheDocument();
    // 필터 (FilterTabs의 '전체' 칩 — 뒤에 건수 숫자가 붙음)
    expect(screen.getByRole("button", { name: /^전체 \d/ })).toBeInTheDocument();
    // 빈 테이블 empty 메시지
    expect(screen.getByText(/표시할 항목이 없습니다/)).toBeInTheDocument();
  });

  it("진행률 라벨 = (done/total)*100 %", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("진행률 20%")).toBeInTheDocument();
  });

  it("미수 채권 active=true → vermilion (subcard-value)", () => {
    const { container } = render(<LiveOverview {...baseProps} />);
    const bondValue = Array.from(
      container.querySelectorAll("[data-subcard-value]"),
    ).find((el) => el.textContent === "2") as HTMLElement | undefined;
    expect(bondValue?.className).toMatch(/text-vermilion/);
  });

  it("필터 칩 클릭 시 칩 active 전환", () => {
    render(<LiveOverview {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /^사고/ }));
    expect(screen.getByRole("button", { name: /^사고/ }).className).toMatch(
      /bg-vermilion/,
    );
  });

  it("필터링 결과 카운트 텍스트 표시", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText(/0건 표시 중/)).toBeInTheDocument();
  });

  it("우측 사이드바 영역 렌더 (시스템 헬스 + 콘솔)", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText("시스템 게이트웨이 상태")).toBeInTheDocument();
    expect(screen.getByText("실시간 백그라운드 로그")).toBeInTheDocument();
    // AdminControls 버튼 없음
    expect(
      screen.queryByRole("button", { name: /실시간 스트림 활성화/ }),
    ).toBeNull();
  });

  it("initialConsoleLines 전달 시 해당 텍스트가 콘솔에 표시됨", () => {
    const seedLines = [
      { text: "[HANDOVER] 인수인계 등록 완료", type: "info" as const },
      { text: "[INCIDENTS] 장애 발생", type: "err" as const },
    ];
    render(<LiveOverview {...baseProps} initialConsoleLines={seedLines} />);
    expect(screen.getByText("[HANDOVER] 인수인계 등록 완료")).toBeInTheDocument();
    expect(screen.getByText("[INCIDENTS] 장애 발생")).toBeInTheDocument();
  });

  it("mine=true + myEmail 전달 시 렌더 에러 없음", () => {
    expect(() =>
      render(
        <LiveOverview
          {...baseProps}
          mine={true}
          myEmail="user@example.com"
        />,
      ),
    ).not.toThrow();
  });
});
