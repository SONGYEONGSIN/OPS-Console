import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
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
  title: "실시간 운영 현황",
  kpi: {
    sago: { count: 3, sparklineD: "M 0,30 L 100,2" },
    todo: { count: 7, done: 2, total: 10 },
    service: { count: 5, sparklineD: "M 0,35 L 100,12" },
  },
  metrics: {
    contract: { value: 1, desc: "체결 진행중" },
    bond: { value: 2, active: true, desc: "미지급 고지 발송" },
    backup: { value: 0, desc: "요청 처리건" },
    contacts: { value: 5, desc: "등록된 파트너" },
    scheduleActivity: { value: "0 / 5", desc: "금주 잔여 건" },
  },
  tableItems: [],
};

beforeEach(() => {
  mockReducedMotion();
  push.mockClear();
});

describe("LiveOverview (Phase 1)", () => {
  it("헤더 + 3 KPI 카드 + 2 그룹박스 + 필터 + 테이블 렌더", () => {
    render(<LiveOverview {...baseProps} />);
    // 헤더
    expect(screen.getByText("실시간 운영 현황")).toBeInTheDocument();
    // KPI 3 카드 label
    expect(screen.getByText("미해결 사고 현황")).toBeInTheDocument();
    expect(screen.getByText("내 미완료 할 일")).toBeInTheDocument();
    expect(screen.getByText("오픈 예정 서비스")).toBeInTheDocument();
    // 그룹박스 title
    expect(screen.getByText("재정 및 영업 행정")).toBeInTheDocument();
    expect(screen.getByText(/시스템 리소스/)).toBeInTheDocument();
    // 필터
    expect(screen.getByRole("button", { name: /전체 내역/ })).toBeInTheDocument();
    // 빈 테이블 empty 메시지
    expect(screen.getByText(/운영 내역이 없습니다/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /사고 경보/ }));
    expect(screen.getByRole("button", { name: /사고 경보/ }).className).toMatch(
      /bg-vermilion/,
    );
  });

  it("필터링 결과 카운트 텍스트 표시", () => {
    render(<LiveOverview {...baseProps} />);
    expect(screen.getByText(/필터링된 결과: 0건/)).toBeInTheDocument();
  });
});
