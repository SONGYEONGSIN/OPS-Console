import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

let mockSlug = "pims";
let notFoundCalled = false;

vi.mock("next/navigation", () => ({
  useParams: () => ({ slug: mockSlug }),
  notFound: () => {
    notFoundCalled = true;
    throw new Error("not-found");
  },
}));

import DynamicDashboardPage from "../page";

describe("DynamicDashboardPage — project 패턴 분기", () => {
  it("project slug(pims) → ProjectPattern 렌더 + 탭 3개", () => {
    mockSlug = "pims";
    notFoundCalled = false;
    render(<DynamicDashboardPage />);
    expect(screen.getByRole("heading", { name: "PIMS", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /상세/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /개선사항/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /활동 로그/ })).toBeInTheDocument();
  });

  it("list slug(contracts) → ProjectPattern 미렌더", () => {
    mockSlug = "contracts";
    notFoundCalled = false;
    render(<DynamicDashboardPage />);
    // ProjectPattern의 탭 미존재
    expect(screen.queryByRole("tab", { name: /상세/ })).not.toBeInTheDocument();
  });

  it("잘못된 slug → notFound 호출", () => {
    mockSlug = "nonexistent-zzz";
    notFoundCalled = false;
    expect(() => render(<DynamicDashboardPage />)).toThrow("not-found");
    expect(notFoundCalled).toBe(true);
  });
});
