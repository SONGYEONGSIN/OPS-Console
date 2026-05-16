import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CategoryNav } from "../CategoryNav";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/handover/abc",
  useSearchParams: () => useSearchParamsMock(),
}));

describe("CategoryNav", () => {
  it("6 카테고리 노출 — 계약/작업/정산/연락처/서류제출/기타", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<CategoryNav />);
    expect(screen.getByText("계약")).toBeInTheDocument();
    expect(screen.getByText("작업")).toBeInTheDocument();
    expect(screen.getByText("정산")).toBeInTheDocument();
    expect(screen.getByText("연락처")).toBeInTheDocument();
    expect(screen.getByText("서류제출")).toBeInTheDocument();
    expect(screen.getByText("기타")).toBeInTheDocument();
  });

  it("default active = 계약 (?cat 미지정)", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<CategoryNav />);
    const link = screen.getByText("계약").closest("a");
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("?cat=work 시 작업 active", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("cat=work"));
    render(<CategoryNav />);
    const link = screen.getByText("작업").closest("a");
    expect(link?.getAttribute("aria-current")).toBe("page");
  });

  it("각 항목 href에 ?cat= 포함", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<CategoryNav />);
    expect(screen.getByText("계약").closest("a")?.getAttribute("href")).toBe(
      "/dashboard/handover/abc?cat=contract",
    );
    expect(screen.getByText("작업").closest("a")?.getAttribute("href")).toBe(
      "/dashboard/handover/abc?cat=work",
    );
  });
});
