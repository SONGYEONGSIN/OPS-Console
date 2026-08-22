import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DevTestTabs } from "../DevTestTabs";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

describe("DevTestTabs", () => {
  it("default(개발) 활성 — tab 미지정", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    expect(screen.getByText("개발").getAttribute("aria-current")).toBe("page");
  });

  it("tab=test 시 테스트 활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=test"));
    render(<DevTestTabs />);
    expect(screen.getByText("테스트").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("tab=open-notice 시 오픈안내 활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=open-notice"));
    render(<DevTestTabs />);
    expect(screen.getByText("오픈안내").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("개발 · 테스트 · 오픈안내 순서", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("개발");
    expect(links[1]).toHaveTextContent("테스트");
    expect(links[2]).toHaveTextContent("오픈안내");
  });

  it("dev 탭 href는 query 없는 /dashboard/dev-test, test 탭 href는 ?tab=test", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    expect(screen.getByText("개발").getAttribute("href")).toBe(
      "/dashboard/dev-test",
    );
    expect(screen.getByText("테스트").getAttribute("href")).toBe(
      "/dashboard/dev-test?tab=test",
    );
    expect(screen.getByText("오픈안내").getAttribute("href")).toBe(
      "/dashboard/dev-test?tab=open-notice",
    );
  });

  it("탭 href 는 기존 검색·필터 파라미터를 버린다 (탭 전환 시 리셋)", () => {
    // 이 동작이 스테일 페이지·필터를 막는 장치다. '개선'하면 안 된다.
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("tab=test&q=조선&page=3&category=수시"),
    );
    render(<DevTestTabs />);
    expect(screen.getByText("오픈안내").getAttribute("href")).toBe(
      "/dashboard/dev-test?tab=open-notice",
    );
    expect(screen.getByText("개발").getAttribute("href")).toBe(
      "/dashboard/dev-test",
    );
  });
});
