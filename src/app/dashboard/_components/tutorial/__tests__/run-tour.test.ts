import { describe, it, expect, beforeEach, vi } from "vitest";
import type { TutorialStep } from "../tutorial-steps";

const { driveMock, driverMock } = vi.hoisted(() => {
  const driveMock = vi.fn();
  const driverMock = vi.fn((_config?: unknown) => ({ drive: driveMock }));
  return { driveMock, driverMock };
});
vi.mock("driver.js", () => ({ driver: driverMock }));
vi.mock("driver.js/dist/driver.css", () => ({}));

import { runTour } from "../run-tour";

const steps: TutorialStep[] = [
  { element: "#x", title: "제목", description: "설명" },
];

describe("runTour", () => {
  beforeEach(() => {
    driveMock.mockClear();
    driverMock.mockClear();
  });

  it("스텝이 비면 driver를 호출하지 않는다", () => {
    runTour([]);
    expect(driverMock).not.toHaveBeenCalled();
    expect(driveMock).not.toHaveBeenCalled();
  });

  it("스텝을 popover 형태로 매핑해 투어를 시작한다", () => {
    runTour(steps);
    expect(driveMock).toHaveBeenCalledTimes(1);
    const cfg = driverMock.mock.calls[0]![0] as {
      steps: {
        element?: string;
        popover: { title: string; description: string };
      }[];
      nextBtnText: string;
      prevBtnText: string;
      doneBtnText: string;
    };
    expect(cfg.steps).toHaveLength(1);
    expect(cfg.steps[0]).toEqual({
      element: "#x",
      popover: { title: "제목", description: "설명" },
    });
    expect(cfg.nextBtnText).toBe("다음");
    expect(cfg.prevBtnText).toBe("이전");
    expect(cfg.doneBtnText).toBe("완료"); // 기본값
  });

  it("doneBtnText/onDestroyed 옵션을 전달한다", () => {
    const onDestroyed = vi.fn();
    runTour(steps, { doneBtnText: "시작하기", onDestroyed });
    const cfg = driverMock.mock.calls[0]![0] as {
      doneBtnText: string;
      onDestroyed: () => void;
    };
    expect(cfg.doneBtnText).toBe("시작하기");
    expect(cfg.onDestroyed).toBe(onDestroyed);
  });

  it("팝업 크기 조정용 popoverClass를 지정한다", () => {
    runTour(steps);
    const cfg = driverMock.mock.calls[0]![0] as { popoverClass: string };
    expect(cfg.popoverClass).toBe("ops-tour-popover");
  });

  it("navigateTo가 있는 스텝은 onHighlightStarted에서 onNavigate(slug)를 호출한다", () => {
    const onNavigate = vi.fn();
    const navStep: TutorialStep = {
      title: "내 작업",
      description: "개요",
      navigateTo: "my-todo",
    };
    runTour([navStep], { onNavigate });
    const cfg = driverMock.mock.calls[0]![0] as {
      steps: { onHighlightStarted?: () => void }[];
    };
    expect(typeof cfg.steps[0]!.onHighlightStarted).toBe("function");
    cfg.steps[0]!.onHighlightStarted!();
    expect(onNavigate).toHaveBeenCalledWith("my-todo");
  });

  it("navigateTo가 없는 스텝은 onHighlightStarted를 달지 않는다", () => {
    const onNavigate = vi.fn();
    runTour(steps, { onNavigate }); // steps[0]은 navigateTo 없음
    const cfg = driverMock.mock.calls[0]![0] as {
      steps: { onHighlightStarted?: () => void }[];
    };
    expect(cfg.steps[0]!.onHighlightStarted).toBeUndefined();
  });
});
