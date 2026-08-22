import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { PendingLine } from "../PendingLine";

/**
 * 답을 기다리는 동안 보이는 한 줄.
 *
 * 예전에는 문구 둘이 고정으로 떠 있어(“회사 PC로 보냈습니다…”) 30~40초 동안
 * 멈춘 것처럼 보였다. 움직이는 건 점 세 개뿐이었는데, 그건 CSS라 정말 살아 있는지
 * 알려주지 못한다. **경과 초는 매초 바뀌므로** 살아 있다는 증거가 된다.
 */
describe("PendingLine", () => {
  afterEach(() => vi.useRealTimers());

  it("지금 하는 일을 보여준다", () => {
    render(<PendingLine note="기록 전문을 읽는 중" since={Date.now()} />);
    expect(screen.getByText(/기록 전문을 읽는 중/)).toBeTruthy();
  });

  it("경과 초가 시간이 지나면 바뀐다 — 이게 멈춤 착시를 푼다", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    render(<PendingLine note="에이전트 실행 중" since={t0} />);
    expect(screen.getByText(/0초/)).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(3_000);
    });
    expect(screen.getByText(/3초/)).toBeTruthy();
  });

  it("문구가 그대로여도 초는 계속 흐른다 — 문서 하나를 오래 읽을 때가 그렇다", () => {
    vi.useFakeTimers();
    const t0 = Date.now();
    render(<PendingLine note="지식망 문서를 읽는 중 — 부산대학교" since={t0} />);
    act(() => {
      vi.advanceTimersByTime(12_000);
    });
    expect(screen.getByText(/지식망 문서를 읽는 중 — 부산대학교/)).toBeTruthy();
    expect(screen.getByText(/12초/)).toBeTruthy();
  });
});

/**
 * 대기 중에만 캐릭터가 움직인다 — 30~40초 기다림이 이 제품의 약점이라
 * 그때 살아 있다는 신호가 필요하다. 평소엔 정지라 읽기를 방해하지 않는다.
 */
describe("PendingLine — 명보가 공을 툭툭 찬다", () => {
  it("대기 줄에 스프라이트가 있다", () => {
    const { container } = render(<PendingLine note="읽는 중" since={Date.now()} />);
    expect(container.querySelector("svg[data-myeongbo-sprite]")).not.toBeNull();
  });

  it("프레임이 번갈아 바뀐다", () => {
    vi.useFakeTimers();
    const { container } = render(<PendingLine note="읽는 중" since={Date.now()} />);
    const read = () =>
      container.querySelector("svg[data-myeongbo-sprite]")!.getAttribute("data-kicking");
    const first = read();
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(read()).not.toBe(first);
    vi.useRealTimers();
  });
});
