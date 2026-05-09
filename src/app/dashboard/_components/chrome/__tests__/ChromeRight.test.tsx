import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { CurrentOperator } from "@/features/auth/queries";
import type { DashWidget } from "../../patterns/DashPattern";

// signOut은 server action — SessionTimer 자식 의존
vi.mock("@/features/auth/actions", () => ({
  signOut: vi.fn(),
}));

// next/navigation은 AlertsBell 자식 의존
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

import { ChromeRight } from "../ChromeRight";

const operator: CurrentOperator = {
  email: "ysong@example.com",
  operator: null,
  displayName: "송영신",
  role: "팀장",
  team: "운영2팀",
  permission: "admin",
};

const alerts: DashWidget[] = [
  { id: "a1", label: "긴급 알림", tone: "urgent", value: "1건", time: "14:30" },
  { id: "a2", label: "검토 알림", tone: "review", value: "2건", time: "13:15" },
];

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("ChromeRight", () => {
  it("SessionTimer + AlertsBell + ChromeUser 3개 자식이 모두 렌더된다", () => {
    render(<ChromeRight operator={operator} alerts={alerts} />);
    // SessionTimer 라벨
    expect(screen.getByText("세션")).toBeInTheDocument();
    // AlertsBell 라벨 (전용 텍스트)
    expect(screen.getByText("알림")).toBeInTheDocument();
    // ChromeUser displayName
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });

  it("AlertsBell의 urgent 카운트가 props로 전달된 alerts에서 계산된다", () => {
    render(<ChromeRight operator={operator} alerts={alerts} />);
    expect(screen.getByLabelText("알림 1건")).toBeInTheDocument();
  });

  it("divider span 2개가 aria-hidden 으로 렌더된다", () => {
    const { container } = render(
      <ChromeRight operator={operator} alerts={alerts} />,
    );
    const dividers = container.querySelectorAll('span[aria-hidden="true"]');
    expect(dividers.length).toBe(2);
  });
});
