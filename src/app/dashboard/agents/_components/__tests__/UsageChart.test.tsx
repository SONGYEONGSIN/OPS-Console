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

/**
 * 막대가 실제로 그려지는가.
 *
 * 처음 올린 것은 **막대가 아예 안 보였다**(2026-09-07). 줄에 `items-end` 를 줘서
 * 각 칸의 높이가 `auto` 가 됐고, 그러면 자식의 `height: 50%` 는 해석할 기준이 없어
 * 0 이 된다. 숫자와 날짜만 남았다.
 *
 * jsdom 은 배치를 계산하지 않아 픽셀 높이를 못 잰다 — 그래서 **높이가 풀리는
 * 구조인지**를 본다. 이게 이 버그가 드러나는 유일한 자리다.
 */
describe("UsageChart — 막대 높이가 풀리는 구조", () => {
  const daily = [0, 0, 1, 1, 0, 0, 3];
  const today = new Date("2026-09-07T02:00:00Z");

  function chart() {
    return render(<UsageChart daily={daily} today={today} />).container;
  }

  it("줄이 칸 높이를 auto 로 만들지 않는다 — items-end 가 그랬다", () => {
    const row = chart().querySelector("[data-usage-row]");
    expect(row, "막대 줄을 못 찾았습니다").toBeTruthy();
    expect(row!.className).not.toContain("items-end");
  });

  it("줄에 정해진 높이가 있다 — % 는 이걸 기준으로 푼다", () => {
    expect(chart().querySelector("[data-usage-row]")!.className).toMatch(/\bh-\d+\b/);
  });

  it("막대가 놓이는 칸이 기준을 만든다 — relative + flex-1", () => {
    const track = chart().querySelector("[data-usage-track]");
    expect(track, "막대 칸을 못 찾았습니다").toBeTruthy();
    expect(track!.className).toContain("relative");
    expect(track!.className).toContain("flex-1");
  });

  it("막대가 그 칸 안에 바닥부터 선다", () => {
    const bar = chart().querySelector("[data-usage-bar] [data-usage-fill]");
    expect(bar, "막대를 못 찾았습니다").toBeTruthy();
    expect(bar!.className).toContain("absolute");
    expect(bar!.className).toContain("bottom-0");
  });

  it("값이 있는 날은 높이가 0 이 아니다", () => {
    const fills = chart().querySelectorAll<HTMLElement>("[data-usage-fill]");
    // 마지막 칸이 최대값(3)이라 100%.
    expect(fills[6].style.height).toBe("100%");
    // 1건짜리도 보이는 두께를 갖는다 — 33% 는 충분하다.
    expect(parseFloat(fills[2].style.height)).toBeGreaterThan(10);
  });

  it("0 인 날은 바닥선만 — 없음과 안 잼을 구분한다", () => {
    const fills = chart().querySelectorAll<HTMLElement>("[data-usage-fill]");
    expect(parseFloat(fills[0].style.height)).toBeLessThan(5);
  });
});
