import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { HandoverTabs } from "../HandoverTabs";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

describe("HandoverTabs", () => {
  it("default(인수인계 내용) 활성 — tab 미지정", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverTabs />);
    const content = screen.getByText("인수인계 내용");
    expect(content.getAttribute("aria-current")).toBe("page");
  });

  it("tab=progress 시 진행 활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=progress"));
    render(<HandoverTabs />);
    expect(screen.getByText("인수인계 진행").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("3 탭 모두 노출", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverTabs />);
    expect(screen.getByText("인수인계 내용")).toBeInTheDocument();
    expect(screen.getByText("인수인계 진행")).toBeInTheDocument();
    expect(screen.getByText("인수인계 확인")).toBeInTheDocument();
  });

  it("content 탭 href는 query 없는 /dashboard/handover", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverTabs />);
    expect(
      screen.getByText("인수인계 내용").getAttribute("href"),
    ).toBe("/dashboard/handover");
  });

  it("progress/history 탭 href는 ?tab=", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<HandoverTabs />);
    expect(
      screen.getByText("인수인계 진행").getAttribute("href"),
    ).toBe("/dashboard/handover?tab=progress");
    expect(
      screen.getByText("인수인계 확인").getAttribute("href"),
    ).toBe("/dashboard/handover?tab=history");
  });
});
