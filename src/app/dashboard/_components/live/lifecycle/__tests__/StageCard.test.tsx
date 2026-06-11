import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { StageCard } from "../StageCard";

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

describe("StageCard", () => {
  beforeEach(() => {
    mockReducedMotion();
  });
  it("일반 모드: 라벨 / tag 배지 / 카운트(숫자) / meta 렌더", () => {
    render(
      <StageCard
        label="진행 중"
        tag="작성 중"
        count={28}
        meta="서비스 마감 연동"
        variant="prog"
      />,
    );
    expect(screen.getByText("진행 중")).toBeInTheDocument();
    expect(screen.getByText("작성 중")).toBeInTheDocument();
    expect(screen.getByText("28")).toBeInTheDocument();
    expect(screen.getByText("서비스 마감 연동")).toBeInTheDocument();
  });

  it("variant별 상단 accent 색상 클래스", () => {
    const { container: soon } = render(
      <StageCard label="예정" tag="예정" count={12} meta="m" variant="soon" />,
    );
    expect((soon.firstChild as HTMLElement).className).toMatch(/border-t-sage/);

    const { container: prog } = render(
      <StageCard label="진행" tag="t" count={1} meta="m" variant="prog" />,
    );
    expect((prog.firstChild as HTMLElement).className).toMatch(
      /border-t-vermilion/,
    );

    const { container: done } = render(
      <StageCard label="마감" tag="t" count={1} meta="m" variant="done" />,
    );
    expect((done.firstChild as HTMLElement).className).toMatch(
      /border-t-muted/,
    );

    const { container: settle } = render(
      <StageCard label="정산" tag="t" count={null} meta="m" variant="settle" />,
    );
    expect((settle.firstChild as HTMLElement).className).toMatch(
      /border-t-gold/,
    );
  });

  it("settle 셸 모드: count=null이면 '—' 표시 + text-faint", () => {
    render(
      <StageCard
        label="전형료 정산"
        tag="예정"
        count={null}
        meta="백엔드 후속 (셸)"
        variant="settle"
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByText("백엔드 후속 (셸)")).toBeInTheDocument();
    const dash = screen.getByText("—");
    expect(dash.className).toMatch(/text-faint/);
  });

  it("sparklineD 있으면 SVG path 렌더, 없으면 미렌더", () => {
    const { container: withSpark } = render(
      <StageCard
        label="진행"
        tag="t"
        count={5}
        meta="m"
        variant="prog"
        sparklineD="M0 10 L100 5"
      />,
    );
    expect(withSpark.querySelector("svg path")).not.toBeNull();

    const { container: noSpark } = render(
      <StageCard label="진행" tag="t" count={5} meta="m" variant="prog" />,
    );
    expect(noSpark.querySelector("svg")).toBeNull();
  });

  it("meta는 ReactNode 허용", () => {
    render(
      <StageCard
        label="마감"
        tag="마감"
        count={41}
        meta={<span className="text-vermilion">이번 주 마감 6</span>}
        variant="done"
      />,
    );
    expect(screen.getByText("이번 주 마감 6")).toBeInTheDocument();
  });
});
