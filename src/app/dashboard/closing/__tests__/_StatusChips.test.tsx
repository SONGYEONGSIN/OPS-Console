import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const push = vi.fn();
let search = "";
let path = "/dashboard/closing";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => path,
  useSearchParams: () => new URLSearchParams(search),
}));

import { ClosingStatusChips } from "../_StatusChips";

const COUNTS = { all: 120, mine: 30 };

beforeEach(() => {
  push.mockClear();
  search = "";
  path = "/dashboard/closing";
});

/**
 * 마감여부는 이제 **메뉴가 정한다**(배포·운영 = 진행중 / 서비스마감 = 마감).
 * 그래서 칩에는 진행중이 없고, '전체'는 그 메뉴가 맡은 범위의 전체를 뜻한다.
 */
describe("ClosingStatusChips", () => {
  it("전체/내 마감 두 칩 + 기본 '내 마감' 활성", () => {
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    expect(screen.getByRole("button", { name: "내 마감" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "전체" })).toBeInTheDocument();
  });

  it("진행중 칩은 없다 — 메뉴가 이미 범위를 정했다", () => {
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    expect(screen.queryByRole("button", { name: "진행중" })).toBeNull();
  });

  it("배포·운영에서는 '내 서비스'다 — 마감한 게 아니라 맡고 있는 것이다", () => {
    path = "/dashboard/deploy";
    render(<ClosingStatusChips counts={COUNTS} scope="running" />);
    expect(screen.getByRole("button", { name: "내 서비스" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "내 마감" })).toBeNull();
  });

  it("각 칩에 카운트를 붙인다", () => {
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    expect(screen.getByRole("button", { name: "전체" })).toHaveTextContent(
      "전체 (120)",
    );
    expect(screen.getByRole("button", { name: "내 마감" })).toHaveTextContent(
      "내 마감 (30)",
    );
  });

  it("전체 클릭 → ?status=all (+ page 제거)", () => {
    search = "page=3";
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("status=all");
    expect(url).not.toContain("page=");
  });

  it("내 마감은 기본값이라 URL에서 뺀다", () => {
    search = "status=all";
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    fireEvent.click(screen.getByRole("button", { name: "내 마감" }));
    expect(push.mock.calls[0][0]).not.toContain("status=");
  });

  it("다른 필터는 지키고 간다 — 검색어가 날아가면 처음부터 다시다", () => {
    search = "q=서울&category=수시";
    render(<ClosingStatusChips counts={COUNTS} scope="closed" />);
    fireEvent.click(screen.getByRole("button", { name: "전체" }));
    const url = push.mock.calls[0][0] as string;
    expect(url).toContain("q=%EC%84%9C%EC%9A%B8");
    expect(url).toContain("category=");
  });
});
