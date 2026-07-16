import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NewsKeywordChips } from "../NewsKeywordChips";

const pushMock = vi.fn();
const state = { params: "" };
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard/news",
  useSearchParams: () => new URLSearchParams(state.params),
}));

const KEYWORDS = [
  { keyword: "통폐합", count: 7 },
  { keyword: "폐교", count: 3 },
  { keyword: "정원감축", count: 20 },
];

describe("NewsKeywordChips", () => {
  beforeEach(() => {
    pushMock.mockReset();
    state.params = "";
  });

  it("'전체(합계)' + 키워드 칩에 건수 표기 (인사이트 수집과 동일)", () => {
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    expect(
      screen.getByRole("button", { name: "전체 (30)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "통폐합 (7)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "폐교 (3)" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "정원감축 (20)" }),
    ).toBeInTheDocument();
  });

  it("우측 정렬 — 컨테이너 ml-auto", () => {
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    const group = screen.getByRole("group", { name: "키워드 필터" });
    expect(group.className).toMatch(/ml-auto/);
  });

  it("칩 클릭 → ?keyword set + page 리셋", () => {
    state.params = "page=3";
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    fireEvent.click(screen.getByRole("button", { name: "폐교 (3)" }));
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/news?keyword=${encodeURIComponent("폐교")}`,
    );
  });

  it("활성 칩 재클릭 → keyword 해제", () => {
    state.params = `keyword=${encodeURIComponent("폐교")}`;
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    fireEvent.click(screen.getByRole("button", { name: "폐교 (3)" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/news?");
  });

  it("활성 칩은 인사이트 배지 표준(버밀리언 솔리드), '전체'는 keyword 없을 때 활성", () => {
    state.params = `keyword=${encodeURIComponent("통폐합")}`;
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    const activeClass = screen.getByRole("button", {
      name: "통폐합 (7)",
    }).className;
    expect(activeClass).toMatch(/border-vermilion/);
    expect(activeClass).toMatch(/bg-vermilion(?!\/)/);
    expect(activeClass).toMatch(/text-cream/);
    const idleClass = screen.getByRole("button", {
      name: "전체 (30)",
    }).className;
    expect(idleClass).not.toMatch(/bg-vermilion/);
    expect(idleClass).toMatch(/bg-paper/);
  });

  it("keywords 빈 배열 → 렌더 없음", () => {
    const { container } = render(<NewsKeywordChips keywords={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
