import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkbookLinks } from "../WorkbookLinks";

/**
 * 목록 헤더 액션 버튼 표준(외곽선 변형).
 * services의 BulkPasteAnnouncements와 같은 문자열 — 이 슬롯의 기준이다.
 * 처음 구현이 px-2/border-line-soft/hover:bg-line-soft로 어긋난 채 배포됐고,
 * 스타일을 아무도 단언하지 않아 테스트·CI가 전부 통과했다.
 */
const STANDARD_CLASSES = [
  "border",
  "border-line",
  "bg-transparent",
  "px-3",
  "py-1",
  "text-xs",
  "text-ink",
  "transition-colors",
  "hover:bg-washi",
];

describe("WorkbookLinks", () => {
  it("헤더 액션 버튼 표준 클래스를 쓴다", () => {
    render(
      <WorkbookLinks
        ledgerUrl="https://sp/ledger.xlsx"
        depositUrl="https://sp/deposit.xlsx"
        isAdmin
      />,
    );
    for (const link of screen.getAllByRole("link")) {
      const classes = link.className.split(/\s+/);
      for (const c of STANDARD_CLASSES) {
        expect(classes, `${link.textContent} 에 ${c} 없음`).toContain(c);
      }
    }
  });

  it("미수채권대장 링크를 새 탭으로 연다", () => {
    render(
      <WorkbookLinks
        ledgerUrl="https://sp/ledger.xlsx"
        depositUrl={null}
        isAdmin={false}
      />,
    );
    const a = screen.getByRole("link", { name: "미수채권대장" });
    expect(a).toHaveAttribute("href", "https://sp/ledger.xlsx");
    expect(a).toHaveAttribute("target", "_blank");
    expect(a).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("수수료입금내역은 admin만 본다", () => {
    render(
      <WorkbookLinks
        ledgerUrl={null}
        depositUrl="https://sp/deposit.xlsx"
        isAdmin={false}
      />,
    );
    expect(
      screen.queryByRole("link", { name: "수수료입금내역" }),
    ).not.toBeInTheDocument();
  });

  it("admin이면 수수료입금내역이 보인다", () => {
    render(
      <WorkbookLinks
        ledgerUrl={null}
        depositUrl="https://sp/deposit.xlsx"
        isAdmin
      />,
    );
    expect(
      screen.getByRole("link", { name: "수수료입금내역" }),
    ).toHaveAttribute("href", "https://sp/deposit.xlsx");
  });

  it("링크가 없으면 그 버튼을 그리지 않는다 — 깨진 링크보다 없는 게 낫다", () => {
    render(<WorkbookLinks ledgerUrl={null} depositUrl={null} isAdmin />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
