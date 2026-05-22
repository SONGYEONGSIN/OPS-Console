import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeedRow } from "../FeedRow";
import type { FeedItem } from "../feed";

const item: FeedItem = {
  id: "x1",
  domain: "incidents",
  domainLabel: "사고",
  variant: "incidents",
  date: "2026-05-22",
  dateDisplay: "미해결",
  title: "결제 오류",
  tier: "urgent",
  listRow: {} as never,
};

describe("FeedRow", () => {
  it("도메인 칩/일자/내용 렌더", () => {
    render(<FeedRow item={item} onSelect={() => {}} />);
    expect(screen.getByText("사고")).toBeInTheDocument();
    expect(screen.getByText("미해결")).toBeInTheDocument();
    expect(screen.getByText("결제 오류")).toBeInTheDocument();
  });
  it("클릭 시 onSelect 호출", () => {
    const fn = vi.fn();
    render(<FeedRow item={item} onSelect={fn} />);
    fireEvent.click(screen.getByText("결제 오류"));
    expect(fn).toHaveBeenCalledWith(item);
  });
});
