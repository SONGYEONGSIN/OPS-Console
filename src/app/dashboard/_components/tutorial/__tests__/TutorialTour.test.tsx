import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// driver.js 모킹 — 본 컴포넌트의 "언제 투어를 시작하는가" 로직만 검증
// (하이라이트/위치 계산 등 driver.js 내부 동작은 라이브러리 책임).
const { driveMock, driverMock } = vi.hoisted(() => {
  const driveMock = vi.fn();
  const driverMock = vi.fn((_config?: unknown) => ({ drive: driveMock }));
  return { driveMock, driverMock };
});
vi.mock("driver.js", () => ({ driver: driverMock }));
vi.mock("driver.js/dist/driver.css", () => ({}));

import { TutorialTour } from "../TutorialTour";
import { TUTORIAL_SEEN_KEY, TUTORIAL_STEPS } from "../tutorial-steps";

describe("TutorialTour", () => {
  beforeEach(() => {
    localStorage.clear();
    driveMock.mockClear();
    driverMock.mockClear();
  });

  it("첫 방문(미열람) 시 투어가 자동 시작된다", () => {
    render(<TutorialTour />);
    expect(driveMock).toHaveBeenCalledTimes(1);
  });

  it("이미 열람한 경우 자동 시작되지 않는다", () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    render(<TutorialTour />);
    expect(driveMock).not.toHaveBeenCalled();
  });

  it("도움말 버튼으로 이미 열람했어도 다시 시작할 수 있다", () => {
    localStorage.setItem(TUTORIAL_SEEN_KEY, "1");
    render(<TutorialTour />);
    expect(driveMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "도움말" }));
    expect(driveMock).toHaveBeenCalledTimes(1);
  });

  it("driver에 전체 스텝과 한글 버튼 라벨을 전달한다", () => {
    render(<TutorialTour />);
    const config = driverMock.mock.calls[0]![0] as unknown as {
      steps: unknown[];
      nextBtnText: string;
      prevBtnText: string;
      doneBtnText: string;
    };
    expect(config.steps).toHaveLength(TUTORIAL_STEPS.length);
    expect(config.nextBtnText).toBe("다음");
    expect(config.prevBtnText).toBe("이전");
    expect(config.doneBtnText).toBe("시작하기");
  });
});
