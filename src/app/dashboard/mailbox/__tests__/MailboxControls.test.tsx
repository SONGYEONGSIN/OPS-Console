import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const push = vi.fn();
let search = "";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => "/dashboard/mailbox",
  useSearchParams: () => new URLSearchParams(search),
}));

import { MailboxControls } from "../MailboxControls";

beforeEach(() => {
  push.mockClear();
  search = "";
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MailboxControls", () => {
  it("검색어 입력 → 디바운스 후 ?q= 갱신 + page 제거", () => {
    search = "page=2";
    render(<MailboxControls />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "김민수" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(push).toHaveBeenCalledTimes(1);
    const url = push.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/dashboard\/mailbox\?/);
    expect(url).toMatch(/q=/);
    expect(url).not.toContain("page=");
  });
});
