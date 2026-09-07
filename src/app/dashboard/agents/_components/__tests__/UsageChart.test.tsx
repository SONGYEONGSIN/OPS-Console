import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsageChart, usageDayLabels } from "../UsageChart";

/**
 * `최근 7일 · 0 · 0 · 1 · 1 · 0 · 0 · 3` 이 무엇인지 알 수 없었다(2026-09-07 지적).
 * 숫자만 늘어놓으면 **어느 날 것인지·무슨 단위인지** 둘 다 모른다.
 */
describe("usageDayLabels", () => {
  const today = new Date("2026-09-07T02:00:00Z"); // KST 11:00

  it("마지막 칸이 오늘 — daily 는 오름차순이다", () => {
    const labels = usageDayLabels(7, today);
    expect(labels[6]).toBe("9/7");
  });

  it("첫 칸은 6일 전", () => {
    expect(usageDayLabels(7, today)[0]).toBe("9/1");
  });

  it("달을 넘어가도 맞다", () => {
    const labels = usageDayLabels(3, new Date("2026-10-01T02:00:00Z"));
    expect(labels).toEqual(["9/29", "9/30", "10/1"]);
  });

  it("길이가 daily 와 같다", () => {
    expect(usageDayLabels(5, today)).toHaveLength(5);
  });
});

describe("UsageChart", () => {
  const daily = [0, 0, 1, 1, 0, 0, 3];
  const today = new Date("2026-09-07T02:00:00Z");

  it("날짜를 붙인다 — 어느 날 것인지 알아야 한다", () => {
    render(<UsageChart daily={daily} today={today} />);
    expect(screen.getByText("9/7")).toBeInTheDocument();
    expect(screen.getByText("9/1")).toBeInTheDocument();
  });

  it("단위를 밝힌다 — 건수인지 비용인지 알 수 없었다", () => {
    render(<UsageChart daily={daily} today={today} />);
    expect(screen.getByText(/실행 건수/)).toBeInTheDocument();
  });

  it("합계를 보여준다 — 막대만으로는 총량을 못 읽는다", () => {
    render(<UsageChart daily={daily} today={today} />);
    expect(screen.getByText(/5건/)).toBeInTheDocument();
  });

  it("최대값을 밝힌다 — 막대 높이가 상대값이라 기준이 필요하다", () => {
    render(<UsageChart daily={daily} today={today} />);
    expect(screen.getByText(/하루 최대 3건/)).toBeInTheDocument();
  });

  it("값이 0인 날도 칸을 차지한다 — 빠지면 날짜가 밀린다", () => {
    const { container } = render(<UsageChart daily={daily} today={today} />);
    expect(container.querySelectorAll("[data-usage-bar]")).toHaveLength(7);
  });

  it("너비를 채운다 — 고정 폭 글자 막대가 아니다", () => {
    const { container } = render(<UsageChart daily={daily} today={today} />);
    expect(container.firstElementChild?.className).toContain("w-full");
  });

  it("전부 0이면 그렇게 말한다 — 빈 막대만 두면 고장으로 읽힌다", () => {
    render(<UsageChart daily={[0, 0, 0]} today={today} />);
    expect(screen.getByText(/실행이 없습니다/)).toBeInTheDocument();
  });

  it("각 막대에 그 날 값이 붙는다", () => {
    render(<UsageChart daily={daily} today={today} />);
    expect(screen.getByTitle("9/7 · 3건")).toBeInTheDocument();
  });
});
