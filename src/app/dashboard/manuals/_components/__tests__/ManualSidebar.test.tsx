import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ManualSidebar, type CategoryItem } from "../ManualSidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard/manuals",
  useSearchParams: () => new URLSearchParams(""),
}));

const categories: CategoryItem[] = [
  { value: "_folder", label: "폴더", desc: null, sortOrder: 0, count: 4 },
  { value: "A", label: "A", desc: "원서접수", sortOrder: 1, count: 15 },
  { value: "B", label: "B", desc: "보증보험", sortOrder: 2, count: 2 },
  { value: "I", label: "I", desc: "영국문화원 · 홍대미활", sortOrder: 9, count: 4 },
  { value: "_etc", label: "기타", desc: null, sortOrder: 99, count: 2 },
];

describe("ManualSidebar", () => {
  it("전체 + 모든 카테고리 라벨 노출 (desc 우선, 없으면 label fallback)", () => {
    render(<ManualSidebar totalCount={89} categories={categories} />);
    expect(screen.getByText("전체")).toBeInTheDocument();
    expect(screen.getByText("폴더")).toBeInTheDocument(); // desc null → label
    expect(screen.getByText("원서접수")).toBeInTheDocument(); // desc 우선
    expect(screen.getByText("영국문화원 · 홍대미활")).toBeInTheDocument();
    expect(screen.getByText("기타")).toBeInTheDocument(); // desc null → label
  });

  it("각 카테고리 row에 개수 표시", () => {
    render(<ManualSidebar totalCount={89} categories={categories} />);
    expect(screen.getByText("89")).toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getAllByText("4").length).toBeGreaterThanOrEqual(2); // 폴더 + I
  });

  it("desc 있는 카테고리는 desc로 표시 (알파벳 prefix 제거)", () => {
    render(<ManualSidebar totalCount={89} categories={categories} />);
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("보증보험")).toBeInTheDocument();
    // 알파벳 단독 노출 안 됨
    expect(screen.queryByText("A")).toBeNull();
    expect(screen.queryByText("B")).toBeNull();
  });

  it("sortOrder 기준 정렬 — 폴더 먼저, 기타 끝", () => {
    const { container } = render(
      <ManualSidebar totalCount={89} categories={categories} />,
    );
    const text = (container.textContent ?? "").replace(/\s+/g, "");
    const folderIdx = text.indexOf("폴더");
    const aIdx = text.indexOf("원서접수");
    const etcIdx = text.indexOf("기타");
    expect(folderIdx).toBeGreaterThan(-1);
    expect(folderIdx).toBeLessThan(aIdx);
    expect(aIdx).toBeLessThan(etcIdx);
  });

  it("desc로 표시되는 카테고리 클릭 시 /dashboard/manuals?category=A 링크", () => {
    render(<ManualSidebar totalCount={89} categories={categories} />);
    const aLink = screen.getByText("원서접수").closest("a");
    expect(aLink).toHaveAttribute("href", "/dashboard/manuals?category=A");
  });

  it("'전체' 링크는 category 쿼리 없이 /dashboard/manuals", () => {
    render(<ManualSidebar totalCount={89} categories={categories} />);
    const allLink = screen.getByText("전체").closest("a");
    expect(allLink).toHaveAttribute("href", "/dashboard/manuals");
  });
});
