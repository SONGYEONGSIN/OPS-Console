import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { OpsGuideNav } from "../OpsGuideNav";
import { OPERATING_GUIDE_TABS } from "../../_data/tabs";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/operating-guide",
  useSearchParams: () => new URLSearchParams("tab=vibe-coding"),
}));

describe("OpsGuideNav", () => {
  it("5개 탭 라벨 + desc 표시", () => {
    render(<OpsGuideNav tabs={OPERATING_GUIDE_TABS} />);
    expect(screen.getByText("바이브코딩")).toBeInTheDocument();
    expect(screen.getByText("운영 노하우")).toBeInTheDocument();
    expect(screen.getByText("트러블슈팅")).toBeInTheDocument();
    expect(screen.getByText("협업")).toBeInTheDocument();
    expect(screen.getByText("도구 사용법")).toBeInTheDocument();
    // desc 한 개라도 노출
    expect(screen.getByText(/Claude Code/)).toBeInTheDocument();
  });

  it("선택된 탭 링크는 aria-current=page", () => {
    render(<OpsGuideNav tabs={OPERATING_GUIDE_TABS} />);
    const activeLink = screen.getByText("바이브코딩").closest("a");
    expect(activeLink).toHaveAttribute("aria-current", "page");
  });

  it("각 탭 링크는 ?tab=value 형식", () => {
    render(<OpsGuideNav tabs={OPERATING_GUIDE_TABS} />);
    const knowHow = screen.getByText("운영 노하우").closest("a");
    expect(knowHow).toHaveAttribute(
      "href",
      "/dashboard/operating-guide?tab=know-how",
    );
  });
});
