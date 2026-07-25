import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/mailbox",
  useSearchParams: () => new URLSearchParams(search),
}));

import { MailboxScopeChips } from "../MailboxScopeChips";

const COUNTS = { all: 40, unreplied: 12, today: 5, unread: 8 };

beforeEach(() => {
  push.mockClear();
  search = "";
});

describe("MailboxScopeChips", () => {
  it("4칩 렌더 + 각 카운트(N) 표시, 기본 '전체' 활성", () => {
    render(<MailboxScopeChips counts={COUNTS} />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveTextContent(
      "전체 (40)",
    );
    expect(screen.getByRole("button", { name: "미회신" })).toHaveTextContent(
      "미회신 (12)",
    );
    expect(screen.getByRole("button", { name: "오늘" })).toHaveTextContent(
      "오늘 (5)",
    );
    expect(screen.getByRole("button", { name: "안읽음" })).toHaveTextContent(
      "안읽음 (8)",
    );
    expect(screen.getByRole("button", { name: "전체" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("미회신 클릭 → ?scope=unreplied (+ page 제거)", () => {
    search = "page=3";
    render(<MailboxScopeChips counts={COUNTS} />);
    fireEvent.click(screen.getByRole("button", { name: "미회신" }));
    expect(push).toHaveBeenCalledWith("/dashboard/mailbox?scope=unreplied");
  });

  it("전체 클릭 → scope 파라미터 제거(기본값)", () => {
    search = "scope=unread";
    render(<MailboxScopeChips counts={COUNTS} />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(push).toHaveBeenCalledWith("/dashboard/mailbox?");
  });
});
