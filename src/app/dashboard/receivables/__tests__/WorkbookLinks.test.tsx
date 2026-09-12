import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkbookLinks } from "../WorkbookLinks";

/**
 * 원본 엑셀 바로가기 — 미수채권 칩 줄.
 *
 * 예전엔 링크 조회에 실패한 항목을 **아예 안 그렸다.** 그러면 '기능이 없는 것'과
 * 구분되지 않는다(총괄장에서 실제로 겪었다, 2026-09-09). 이제 버튼은 늘 있고
 * 주소는 창구가 클릭 시점에 푼다.
 *
 * 다만 `isAdmin` 은 성격이 다르다 — 조회 실패로 **우연히** 사라지는 게 아니라
 * 권한에 따라 **의도적으로** 안 보이는 것이다. 그래서 남긴다.
 */
describe("WorkbookLinks", () => {
  it("미수채권대장은 늘 보인다 — 조회 실패가 버튼을 지우지 않는다", () => {
    render(<WorkbookLinks isAdmin={false} />);
    expect(
      screen.getByRole("link", { name: "미수채권대장" }),
    ).toHaveAttribute("href", "/dashboard/workbook/receivables-ledger");
  });

  it("admin 은 수수료입금내역도 본다", () => {
    render(<WorkbookLinks isAdmin />);
    expect(
      screen.getByRole("link", { name: "수수료입금내역" }),
    ).toHaveAttribute("href", "/dashboard/workbook/receivables-deposit");
  });

  /** 미수채권 화면 자체는 member·viewer 도 들어온다 — 여기서 가려야 한다. */
  it("admin 이 아니면 수수료입금내역은 안 보인다", () => {
    render(<WorkbookLinks isAdmin={false} />);
    expect(
      screen.queryByRole("link", { name: "수수료입금내역" }),
    ).not.toBeInTheDocument();
  });

  /** 화면에서 가리는 건 '보이느냐'일 뿐이다 — 서버도 라우트에서 막는다. */
  it("입금내역 주소는 창구를 거친다 — 원본 주소를 화면에 박지 않는다", () => {
    render(<WorkbookLinks isAdmin />);
    for (const name of ["수수료입금내역", "미수채권대장"]) {
      expect(screen.getByRole("link", { name })).toHaveAttribute(
        "href",
        expect.stringContaining("/dashboard/workbook/"),
      );
    }
  });
});
