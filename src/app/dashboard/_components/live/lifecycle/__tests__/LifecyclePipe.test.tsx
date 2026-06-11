import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { LifecyclePipe } from "../LifecyclePipe";
import type { LifecycleStage } from "../LifecyclePipe";

// CountUp 재사용 컴포넌트가 window.matchMedia를 요구 — reduce=true로 즉시 value 표시
function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (q: string) => ({
      matches: q.includes("reduce"),
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      onchange: null,
      media: q,
      dispatchEvent: () => false,
    }),
  });
}

const stages: LifecycleStage[] = [
  { label: "예정", tag: "신규", count: 12, meta: "신규 접수", variant: "soon" },
  {
    label: "진행 중",
    tag: "작성 중",
    count: 28,
    meta: "서비스 마감 연동",
    variant: "prog",
    sparklineD: "M0 10 L100 6",
  },
  {
    label: "마감 완료",
    tag: "마감",
    count: 41,
    meta: "이번 주 6",
    variant: "done",
  },
  {
    label: "전형료 정산",
    tag: "후속",
    count: null,
    meta: "백엔드 후속 (셸)",
    variant: "settle",
  },
];

describe("LifecyclePipe", () => {
  beforeEach(() => {
    mockReducedMotion();
  });
  it("4개 스테이지 라벨 모두 렌더", () => {
    render(<LifecyclePipe stages={stages} />);
    expect(screen.getByText("예정")).toBeInTheDocument();
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("마감 완료")).toBeInTheDocument();
    expect(screen.getByText("전형료 정산")).toBeInTheDocument();
  });

  it("스테이지 사이 화살표 3개 렌더", () => {
    const { container } = render(<LifecyclePipe stages={stages} />);
    const arrows = container.querySelectorAll("[data-pipe-arrow]");
    expect(arrows.length).toBe(3);
    arrows.forEach((a) => expect(a.textContent).toBe("→"));
  });

  it("pipe 그리드 컨테이너 클래스 적용", () => {
    const { container } = render(<LifecyclePipe stages={stages} />);
    expect((container.firstChild as HTMLElement).className).toMatch(/grid/);
  });
});
