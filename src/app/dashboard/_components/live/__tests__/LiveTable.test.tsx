import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveTable } from "../LiveTable";
import type { LiveTableItem } from "../live-table-builder";

const items: LiveTableItem[] = [
  {
    id: "i1",
    domain: "incidents",
    badgeDomain: "사고",
    variant: "incidents",
    statusText: "미해결",
    title: "결제 오류",
    timeText: "방금 전",
    occurredAt: "2026-05-23T11:55:00+09:00",
    listRow: {} as never,
  },
];

describe("LiveTable", () => {
  it("4 컬럼 헤더 + 한 행 렌더", () => {
    render(<LiveTable items={items} onSelect={() => {}} />);
    expect(screen.getByText("구분")).toBeInTheDocument();
    expect(screen.getByText("상태/구분")).toBeInTheDocument();
    expect(screen.getByText("운영 이벤트 내역 및 타이틀")).toBeInTheDocument();
    expect(screen.getByText("발생 시점")).toBeInTheDocument();
    expect(screen.getByText("사고")).toBeInTheDocument();
    expect(screen.getByText("미해결")).toBeInTheDocument();
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
    expect(screen.getByText("방금 전")).toBeInTheDocument();
  });

  it("빈 items → empty 메시지", () => {
    render(<LiveTable items={[]} onSelect={() => {}} />);
    expect(screen.getByText(/운영 내역이 없습니다/)).toBeInTheDocument();
  });

  it("행 클릭 시 onSelect(item) 호출", () => {
    const fn = vi.fn();
    render(<LiveTable items={items} onSelect={fn} />);
    fireEvent.click(screen.getByText("결제 오류"));
    expect(fn).toHaveBeenCalledWith(items[0]);
  });
});
