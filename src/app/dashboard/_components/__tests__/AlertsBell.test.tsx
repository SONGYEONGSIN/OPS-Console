import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { AlertsBell } from "../AlertsBell";
import type { OpsAlert } from "@/features/alerts/queries";

const fixtures: OpsAlert[] = [
  {
    id: "incident-1",
    tone: "urgent",
    category: "사고",
    label: "결제 게이트웨이 350ms",
    time: "5.20 14:23",
    href: "/dashboard/incidents",
  },
  {
    id: "handover-1",
    tone: "review",
    category: "인수인계 수신",
    label: "한양대학교 · 수시 (송영석)",
    time: "5.20 13:00",
    href: "/dashboard/handover?tab=history",
  },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("AlertsBell", () => {
  it("배지는 처리 필요 액션 수 (ok=worklog 제외)", () => {
    const withOk: OpsAlert[] = [
      ...fixtures,
      {
        id: "worklog-1",
        tone: "ok",
        category: "활동",
        label: "페이지 진입",
        time: "14:00",
        href: "/dashboard/worklog",
      },
    ];
    render(<AlertsBell items={withOk} />);
    // urgent 1 + review 1 = 2 (ok 1건 제외)
    expect(screen.getByLabelText("알림 2건")).toBeInTheDocument();
  });

  it("클릭 시 드롭다운 토글 — 알림 항목 노출", () => {
    render(<AlertsBell items={fixtures} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(screen.getByText("결제 게이트웨이 350ms")).toBeInTheDocument();
    expect(screen.getByText(/한양대학교/)).toBeInTheDocument();
  });

  it("알림 항목은 href 링크", () => {
    render(<AlertsBell items={fixtures} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    const link = screen.getByText("결제 게이트웨이 350ms").closest("a");
    expect(link).toHaveAttribute("href", "/dashboard/incidents");
  });

  it("빈 알림 — '새 알림 없음'", () => {
    render(<AlertsBell items={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(screen.getByText(/새 알림 없음/)).toBeInTheDocument();
  });

  it("다시 클릭하면 드롭다운 닫힘", () => {
    render(<AlertsBell items={fixtures} />);
    const btn = screen.getByRole("button", { name: /알림/ });
    fireEvent.click(btn);
    expect(screen.getByText("결제 게이트웨이 350ms")).toBeInTheDocument();
    act(() => {
      fireEvent.click(btn);
    });
    expect(screen.queryByText("결제 게이트웨이 350ms")).toBeNull();
  });
});
