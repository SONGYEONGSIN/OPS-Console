import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ContractsTable } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

/**
 * 계약종료 칸은 값만 보여주는 게 아니라 **그 값을 어디서 얻었는지**까지 보여준다.
 *
 * 대장에 실제로 적힌 종료월(52곳)과 대장이 비어 학년도로 채운 값(356곳)이 같은
 * 색이면 화면만 보고는 구분할 수 없다. 특히 다년계약인데 대장에 종료일이 없는
 * 9곳은 채운 값이 확실히 틀리므로 색이 달라야 한다.
 */
function row(over: Partial<ListRow>): ListRow {
  return {
    id: "4년제-77",
    name: "조선대학교",
    status: "active",
    owner: "송영신",
    contractSheet: "4년제",
    numbering: "A-3-25",
    contractStatus: "계약완료(영업)",
    serviceActive: "Y",
    feeAmount: "4,300",
    ...over,
  };
}

function cellFor(label: string): HTMLElement {
  const el = screen.getByText(label).closest("td");
  if (!el) throw new Error(`셀을 찾지 못했습니다: ${label}`);
  return el;
}

describe("ContractsTable — 계약종료 칸", () => {
  it("머리글에 계약종료가 있다", () => {
    render(
      <ContractsTable rows={[row({})]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("계약종료")).toBeTruthy();
  });

  it("대장에 적힌 종료월은 기본 톤으로 그대로 보여준다", () => {
    render(
      <ContractsTable
        rows={[row({ contractEndMonth: "2027-07", contractEndKind: "ledger" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const cell = cellFor("2027-07");
    expect(cell.className).toContain("text-ink-soft");
    expect(cell.getAttribute("title")).toBeNull();
  });

  it("대장이 비어 채운 값은 연하게 보여주고 그 사실을 툴팁으로 밝힌다", () => {
    render(
      <ContractsTable
        rows={[
          row({
            name: "가야대학교",
            contractEndMonth: "2027-02",
            contractEndKind: "assumed",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const cell = cellFor("2027-02");
    expect(cell.className).toContain("text-muted");
    expect(cell.getAttribute("title")).toContain("학년도 종료월");
  });

  it("다년계약인데 대장이 비었으면 확인 대상으로 눈에 걸리게 한다", () => {
    // 서울대·부산대·성균관대 등 9곳. 채운 값이 확실히 틀린 자리다.
    render(
      <ContractsTable
        rows={[
          row({
            name: "서울대학교",
            contractEndMonth: "2027-02",
            contractEndKind: "check",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const cell = cellFor("2027-02");
    expect(cell.className).toContain("text-vermilion");
    expect(cell.getAttribute("title")).toContain("확인 필요");
  });

  it("월을 알 수 없는 표기는 지어내지 않고 원문을 보여준다", () => {
    render(
      <ContractsTable
        rows={[
          row({
            name: "동국대학교(서울)",
            contractEndMonth: "~ 2028학년도 후기",
            contractEndKind: "raw",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(cellFor("~ 2028학년도 후기").className).toContain("text-ink-soft");
  });

  it("빈 상태 행이 모든 열을 덮는다 — 열을 늘리고 colSpan 을 안 고치면 표가 어긋난다", () => {
    render(<ContractsTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    const headers = screen.getAllByRole("columnheader");
    const empty = screen.getByText("데이터 없음").closest("td");
    expect(empty?.getAttribute("colSpan")).toBe(String(headers.length));
  });
});
