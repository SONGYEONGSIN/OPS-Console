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

  it("'전체 관점'과 '내 업무만' 버튼을 렌더", () => {
    render(<SegmentToggle mine={false} />);
    expect(
      screen.getByRole("button", { name: "전체 관점" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "내 업무만" })
    ).toBeInTheDocument();
  });

  it("mine=false일 때 '전체 관점' 버튼에 active 스타일(bg-ink) 적용", () => {
    render(<SegmentToggle mine={false} />);
    const allButton = screen.getByRole("button", { name: "전체 관점" });
    expect(allButton.className).toMatch(/bg-ink/);
    expect(allButton.className).toMatch(/text-cream/);
  });

  it("mine=true일 때 '내 업무만' 버튼에 active 스타일(bg-ink) 적용", () => {
    render(<SegmentToggle mine={true} />);
    const mineButton = screen.getByRole("button", { name: "내 업무만" });
    expect(mineButton.className).toMatch(/bg-ink/);
    expect(mineButton.className).toMatch(/text-cream/);
  });

  it("mine=false일 때 '내 업무만' 버튼은 inactive 스타일", () => {
    render(<SegmentToggle mine={false} />);
    const mineButton = screen.getByRole("button", { name: "내 업무만" });
    expect(mineButton.className).not.toMatch(/bg-ink/);
  });

  it("mine=true일 때 '전체 관점' 버튼은 inactive 스타일", () => {
    render(<SegmentToggle mine={true} />);
    const allButton = screen.getByRole("button", { name: "전체 관점" });
    expect(allButton.className).not.toMatch(/bg-ink/);
  });

  it("'내 업무만' 클릭 시 router.push로 ?mine=true 추가", () => {
    render(<SegmentToggle mine={false} />);
    fireEvent.click(screen.getByRole("button", { name: "내 업무만" }));
    expect(pushMock).toHaveBeenCalled();
    const callArg = pushMock.mock.calls[0][0] as string;
    expect(callArg).toMatch(/mine=true/);
  });

  it("'전체 관점' 클릭(mine=true 상태) 시 router.push로 ?mine 제거", () => {
    render(<SegmentToggle mine={true} />);
    fireEvent.click(screen.getByRole("button", { name: "전체 관점" }));
    expect(pushMock).toHaveBeenCalled();
    const callArg = pushMock.mock.calls[0][0] as string;
    expect(callArg).not.toMatch(/mine=true/);
  });
});
