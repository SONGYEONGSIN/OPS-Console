import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetricSubcard } from "../MetricSubcard";

function mockReducedMotion() {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: true, // reduced-motion → CountUp 즉시 value 표시
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

describe("MetricSubcard", () => {
  beforeEach(() => mockReducedMotion());

  it("label / value / desc 렌더", () => {
    render(<MetricSubcard label="체결 계약" value="12" desc="체결 진행중" />);
    expect(screen.getByText("체결 계약")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("체결 진행중")).toBeInTheDocument();
  });

  it("active=true → value text-vermilion", () => {
    const { container } = render(
      <MetricSubcard label="미수 채권" value="3" desc="x" active />
    );
    expect(container.querySelector("[data-subcard-value]")?.className).toMatch(
      /text-vermilion/
    );
  });

  it("active=false → value text-ink", () => {
    const { container } = render(
      <MetricSubcard label="x" value="0" desc="x" />
    );
    expect(container.querySelector("[data-subcard-value]")?.className).toMatch(
      /text-ink(?!-)/
    );
  });

  it("value가 number/string 모두 허용", () => {
    render(<MetricSubcard label="x" value={42} desc="y" />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("number value 1000 이상 → 천단위 구분 (2,283)", () => {
    render(<MetricSubcard label="x" value={2283} desc="y" />);
    expect(screen.getByText("2,283")).toBeInTheDocument();
  });

  it("string value는 포맷 안 함 (그대로 표시)", () => {
    render(<MetricSubcard label="x" value="0 / 5" desc="y" />);
    expect(screen.getByText("0 / 5")).toBeInTheDocument();
  });

  it("fraction object value → CountUp num / den 렌더 + 천단위 구분", () => {
    const { container } = render(
      <MetricSubcard label="인수인계" value={{ num: 6, den: 1500 }} desc="y" />,
    );
    const valueEl = container.querySelector("[data-subcard-value]");
    expect(valueEl?.textContent).toContain("6");
    expect(valueEl?.textContent).toContain("1,500");
    expect(valueEl?.textContent).toContain("/");
  });

  it("valueHint 전달 시 tooltip 노드 + value span에 peer + cursor-help", () => {
    const { container } = render(
      <MetricSubcard label="인수인계" value="6 / 15" desc="진행 완료" valueHint="본인 서비스 중 인수인계 내용 작성한 카운팅" />,
    );
    expect(screen.getByText("본인 서비스 중 인수인계 내용 작성한 카운팅")).toBeInTheDocument();
    const valueEl = container.querySelector("[data-subcard-value]") as HTMLElement | null;
    expect(valueEl?.className).toMatch(/peer/);
    expect(valueEl?.className).toMatch(/cursor-help/);
  });

  it("valueHint 없으면 tooltip 노드 없고 peer/cursor-help 없음", () => {
    const { container } = render(<MetricSubcard label="x" value="1" desc="y" />);
    const valueEl = container.querySelector("[data-subcard-value]") as HTMLElement | null;
    expect(valueEl?.className).not.toMatch(/peer/);
    expect(valueEl?.className).not.toMatch(/cursor-help/);
    expect(container.querySelector("[data-subcard-tooltip]")).toBeNull();
  });
});
