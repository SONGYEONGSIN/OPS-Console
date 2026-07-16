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

  it("개발 탭이 첫 번째 순서", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    const links = screen.getAllByRole("link");
    expect(links[0]).toHaveTextContent("개발");
    expect(links[1]).toHaveTextContent("테스트");
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
  });
});
