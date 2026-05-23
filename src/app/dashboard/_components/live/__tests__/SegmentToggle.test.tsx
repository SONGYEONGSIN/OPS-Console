import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
  useSearchParams: () => new URLSearchParams(""),
}));

import { SegmentToggle } from "../SegmentToggle";

describe("SegmentToggle", () => {
  beforeEach(() => pushMock.mockClear());

  it("'전체'와 '내 담당' 버튼을 렌더", () => {
    render(<SegmentToggle mine={false} />);
    expect(
      screen.getByRole("button", { name: "전체" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "내 담당" })
    ).toBeInTheDocument();
  });

  it("mine=false일 때 '전체' 버튼에 active 스타일(bg-ink) 적용", () => {
    render(<SegmentToggle mine={false} />);
    const allButton = screen.getByRole("button", { name: "전체" });
    expect(allButton.className).toMatch(/bg-ink/);
    expect(allButton.className).toMatch(/text-cream/);
  });

  it("mine=true일 때 '내 담당' 버튼에 active 스타일(bg-ink) 적용", () => {
    render(<SegmentToggle mine={true} />);
    const mineButton = screen.getByRole("button", { name: "내 담당" });
    expect(mineButton.className).toMatch(/bg-ink/);
    expect(mineButton.className).toMatch(/text-cream/);
  });

  it("mine=false일 때 '내 담당' 버튼은 inactive 스타일", () => {
    render(<SegmentToggle mine={false} />);
    const mineButton = screen.getByRole("button", { name: "내 담당" });
    expect(mineButton.className).not.toMatch(/bg-ink/);
  });

  it("mine=true일 때 '전체' 버튼은 inactive 스타일", () => {
    render(<SegmentToggle mine={true} />);
    const allButton = screen.getByRole("button", { name: "전체" });
    expect(allButton.className).not.toMatch(/bg-ink/);
  });

  it("'내 담당' 클릭 시 router.push로 ?mine 제거 (page default 복귀)", () => {
    render(<SegmentToggle mine={false} />);
    fireEvent.click(screen.getByRole("button", { name: "내 담당" }));
    expect(pushMock).toHaveBeenCalled();
    const callArg = pushMock.mock.calls[0][0] as string;
    expect(callArg).not.toMatch(/mine=/);
  });

  it("'전체' 클릭 시 router.push로 ?mine=false 명시", () => {
    render(<SegmentToggle mine={true} />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    expect(pushMock).toHaveBeenCalled();
    const callArg = pushMock.mock.calls[0][0] as string;
    expect(callArg).toMatch(/mine=false/);
  });
});
