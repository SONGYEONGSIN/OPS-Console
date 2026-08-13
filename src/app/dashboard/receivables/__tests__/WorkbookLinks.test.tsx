import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkbookLinks } from "../WorkbookLinks";

describe("WorkbookLinks", () => {
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
