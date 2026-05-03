import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AlertsBell } from "../AlertsBell";
import type { DashWidget } from "../patterns/DashPattern";

const sample: DashWidget[] = [
  { id: "A1", tone: "urgent", label: "결제 지연",       value: "350ms", time: "14:23" },
  { id: "A2", tone: "urgent", label: "사고 보고",       value: "2건",   time: "오늘"  },
  { id: "A3", tone: "review", label: "처리 대기 알림", value: "12건",  time: "현재"  },
  { id: "A4", tone: "ok",     label: "정상 서비스",    value: "47건",  time: "24h"   },
];

describe("AlertsBell", () => {
  it("초기에는 드롭다운 hidden, 알림 개수 배지만 표시", () => {
    render(<AlertsBell items={sample} />);
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText(/2/)).toBeInTheDocument(); // urgent 카운트 (A1, A2)
  });

  it("◎ 버튼 클릭 시 드롭다운 노출", () => {
    render(<AlertsBell items={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("urgent + review 항목만 노출 (ok 제외)", () => {
    render(<AlertsBell items={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(screen.getByText("결제 지연")).toBeInTheDocument();
    expect(screen.getByText("사고 보고")).toBeInTheDocument();
    expect(screen.getByText("처리 대기 알림")).toBeInTheDocument();
    expect(screen.queryByText("정상 서비스")).toBeNull();
  });

  it("각 알림 항목은 /dashboard/alerts 링크", () => {
    const { container } = render(<AlertsBell items={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    const links = container.querySelectorAll('a[href="/dashboard/alerts"]');
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("ESC 누르면 드롭다운 닫힘", () => {
    render(<AlertsBell items={sample} />);
    const btn = screen.getByRole("button", { name: /알림/ });
    fireEvent.click(btn);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("'전체 알림 보기' 푸터 링크 노출", () => {
    render(<AlertsBell items={sample} />);
    fireEvent.click(screen.getByRole("button", { name: /알림/ }));
    expect(screen.getByText(/전체 알림 보기/)).toBeInTheDocument();
  });
});
