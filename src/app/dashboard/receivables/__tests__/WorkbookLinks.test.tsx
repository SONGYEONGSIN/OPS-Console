import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorkbookLinks } from "../WorkbookLinks";

/**
 * 목록 헤더 액션 버튼 표준 — ListPattern 생성 버튼(`+ 백업 요청` 등)과 같은 문자열.
 *
 * 한때 이 슬롯이 셋으로 갈려 있었다 — 생성 버튼·인수인계 복사는 버밀리언, 연락처
 * 일괄등록은 잉크, 발표 서비스 일괄등록은 외곽선. 처음에 그 외곽선 하나를 표준으로
 * 골라 어긋났었다. 두 일괄등록은 `HeaderActionButton` 으로 맞췄다(2026-08-25).
 *
 * 인수인계 '복제' 는 아직 손으로 적혀 있고 치수가 다르다(`text-sm`·`hover:opacity-90`).
 * 드롭다운 토글이라 `aria-expanded` 가 필요해 컴포넌트에 prop 을 더해야 한다 — 별건.
 */
const STANDARD_CLASSES = [
  "border",
  "border-vermilion",
  "bg-vermilion",
  "px-3",
  "py-1",
  "text-xs",
  "font-medium",
  "text-cream",
  "hover:bg-vermilion-deep",
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
