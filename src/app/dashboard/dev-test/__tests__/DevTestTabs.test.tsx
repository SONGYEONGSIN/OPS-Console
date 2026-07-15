import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { DevTestTabs } from "../DevTestTabs";

const useSearchParamsMock = vi.fn(() => new URLSearchParams());

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

describe("DevTestTabs", () => {
  it("default(테스트) 활성 — tab 미지정", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    expect(screen.getByText("테스트").getAttribute("aria-current")).toBe(
      "page",
    );
  });

  it("tab=dev 시 개발 활성", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=dev"));
    render(<DevTestTabs />);
    expect(screen.getByText("개발").getAttribute("aria-current")).toBe("page");
  });

  it("test 탭 href는 query 없는 /dashboard/dev-test, dev 탭 href는 ?tab=dev", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<DevTestTabs />);
    expect(screen.getByText("테스트").getAttribute("href")).toBe(
      "/dashboard/dev-test",
    );
    expect(screen.getByText("개발").getAttribute("href")).toBe(
      "/dashboard/dev-test?tab=dev",
    );
  });
});
