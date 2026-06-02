import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";

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

  it("UI를 렌더하지 않는다 (플로팅 버튼 없음)", () => {
    const { container } = render(<TutorialTour />);
    expect(container.querySelector("button")).toBeNull();
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
