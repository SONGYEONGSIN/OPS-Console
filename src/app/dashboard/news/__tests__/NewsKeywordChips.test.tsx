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

const KEYWORDS = ["통폐합", "폐교", "정원감축"];

describe("NewsKeywordChips", () => {
  beforeEach(() => {
    pushMock.mockReset();
    state.params = "";
  });

  it("'전체' + 키워드 칩 렌더", () => {
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
    for (const kw of KEYWORDS) {
      expect(screen.getByRole("button", { name: kw })).toBeInTheDocument();
    }
  });

  it("칩 클릭 → ?keyword set + page 리셋", () => {
    state.params = "page=3";
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    fireEvent.click(screen.getByRole("button", { name: "폐교" }));
    expect(pushMock).toHaveBeenCalledWith(
      `/dashboard/news?keyword=${encodeURIComponent("폐교")}`,
    );
  });

  it("활성 칩 재클릭 → keyword 해제", () => {
    state.params = `keyword=${encodeURIComponent("폐교")}`;
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    fireEvent.click(screen.getByRole("button", { name: "폐교" }));
    expect(pushMock).toHaveBeenCalledWith("/dashboard/news?");
  });

  it("활성 칩은 버밀리언 선택 표준, '전체'는 keyword 없을 때 활성", () => {
    state.params = `keyword=${encodeURIComponent("통폐합")}`;
    render(<NewsKeywordChips keywords={KEYWORDS} />);
    expect(
      screen.getByRole("button", { name: "통폐합" }).className,
    ).toMatch(/bg-vermilion\/10/);
    expect(
      screen.getByRole("button", { name: "전체" }).className,
    ).not.toMatch(/bg-vermilion\/10/);
  });

  it("keywords 빈 배열 → 렌더 없음", () => {
    const { container } = render(<NewsKeywordChips keywords={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
