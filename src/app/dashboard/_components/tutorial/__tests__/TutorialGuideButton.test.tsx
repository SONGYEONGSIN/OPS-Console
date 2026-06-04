import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SbSection } from "../../../_data";

// driver.js 모킹 — "클릭 시 어떤 스텝으로 투어를 여는가"만 검증.
const { driveMock, driverMock } = vi.hoisted(() => {
  const driveMock = vi.fn();
  const driverMock = vi.fn((_config?: unknown) => ({ drive: driveMock }));
  return { driveMock, driverMock };
});
vi.mock("driver.js", () => ({ driver: driverMock }));
vi.mock("driver.js/dist/driver.css", () => ({}));

import { TutorialGuideButton } from "../TutorialGuideButton";

const sections: SbSection[] = [
  {
    title: "작업",
    entries: [{ kind: "item", ico: "✓", label: "내 작업", slug: "my-todo" }],
  },
];

describe("TutorialGuideButton", () => {
  beforeEach(() => {
    driveMock.mockClear();
    driverMock.mockClear();
  });

  it("'가이드' 버튼을 렌더한다", () => {
    render(<TutorialGuideButton sections={sections} />);
    expect(screen.getByRole("button", { name: /가이드/ })).toBeTruthy();
  });

  it("클릭 시 권한 메뉴 기반 스텝으로 투어를 시작한다", () => {
    render(<TutorialGuideButton sections={sections} />);
    fireEvent.click(screen.getByRole("button", { name: /가이드/ }));
    expect(driveMock).toHaveBeenCalledTimes(1);
    const config = driverMock.mock.calls[0]![0] as { steps: unknown[] };
    // my-todo 시드는 버튼 콘텐츠 보유 → 개요·인터랙션·버튼 3스텝
    expect(config.steps).toHaveLength(3);
  });

  it("표시할 메뉴 콘텐츠가 없으면 투어를 시작하지 않는다", () => {
    const emptySections: SbSection[] = [
      {
        title: "작업",
        entries: [{ kind: "item", ico: "◉", label: "실시간 현황" }],
      },
    ];
    render(<TutorialGuideButton sections={emptySections} />);
    fireEvent.click(screen.getByRole("button", { name: /가이드/ }));
    expect(driveMock).not.toHaveBeenCalled();
  });
});
