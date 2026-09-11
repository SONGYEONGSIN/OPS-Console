import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/dashboard/postal",
}));

import { PostalClient } from "../PostalClient";
import { PettyCashPanel } from "../PettyCashPanel";

/**
 * 원본 엑셀 버튼은 **늘 보여야** 한다.
 *
 * 링크 조회 실패로 사라지는 경로는 고쳤지만, 우편물에는 **두 번째 경로**가 있었다 —
 * 대장을 못 읽으면(`ledger.error`) 표 컴포넌트를 통째로 안 그리고, 전도금 시트가
 * 없으면(`!sheet`) 조기 반환한다. 버튼이 그 안에 있어 같이 사라졌다.
 *
 * **대장을 못 읽은 순간이 바로 원본을 열어 봐야 할 때다.** 그때 버튼이 없으면
 * 사용자가 할 수 있는 게 없다.
 */
describe("우편물 원본 엑셀 버튼", () => {
  it("대장을 못 읽어도 등기대장 버튼은 남는다", () => {
    render(
      <PostalClient
        ledger={{
          error: "시트를 찾지 못했습니다",
          sheetName: "2026",
          rows: [],
          receiptUrls: {},
          years: [],
          year: 2026,
        }}
        receipts={[]}
      />,
    );
    expect(screen.getByRole("link", { name: "등기대장" })).toHaveAttribute(
      "href",
      "/dashboard/workbook/postal-ledger",
    );
  });

  it("전도금 장부를 못 읽어도 전도금대장 버튼은 남는다", () => {
    render(<PettyCashPanel sheet={null} />);
    expect(screen.getByRole("link", { name: "전도금대장" })).toHaveAttribute(
      "href",
      "/dashboard/workbook/postal-petty-cash",
    );
  });

  /** 못 읽은 이유는 그대로 보여야 한다 — 빈 표는 "발송이 없다"로 읽힌다. */
  it("못 읽은 이유도 함께 보여준다", () => {
    render(
      <PostalClient
        ledger={{
          error: "시트를 찾지 못했습니다",
          sheetName: "2026",
          rows: [],
          receiptUrls: {},
          years: [],
          year: 2026,
        }}
        receipts={[]}
      />,
    );
    expect(screen.getByText(/시트를 찾지 못했습니다/)).toBeInTheDocument();
  });
});
