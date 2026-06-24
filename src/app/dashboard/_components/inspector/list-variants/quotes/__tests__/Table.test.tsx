import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { QuoteTable } from "../Table";

function makeRow(over: Partial<ListRow>): ListRow {
  return {
    id: crypto.randomUUID(),
    name: "견적서",
    status: "active",
    owner: "",
    quoteCustomer: "가천대학교",
    quoteDate: "2026-06-24",
    quoteStatus: "draft",
    ...over,
  };
}

describe("QuoteTable", () => {
  it("컬럼 헤더 노출 — 고객·견적일·금액·담당·상태", () => {
    render(<QuoteTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("고객")).toBeInTheDocument();
    expect(screen.getByText("견적일")).toBeInTheDocument();
    expect(screen.getByText("금액")).toBeInTheDocument();
    expect(screen.getByText("담당")).toBeInTheDocument();
    expect(screen.getByText("상태")).toBeInTheDocument();
  });

  it("데이터 없음 → '데이터 없음'", () => {
    render(<QuoteTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("상태 뱃지 — draft='작성중', won='수주', lost='실주'", () => {
    render(
      <QuoteTable
        rows={[
          makeRow({ id: "1", quoteStatus: "draft" }),
          makeRow({ id: "2", quoteStatus: "won" }),
          makeRow({ id: "3", quoteStatus: "lost" }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("작성중")).toBeInTheDocument();
    expect(screen.getByText("수주")).toBeInTheDocument();
    expect(screen.getByText("실주")).toBeInTheDocument();
  });

  it("금액 null → '—'", () => {
    // 담당을 채워 금액 셀만 '—'가 되도록(빈 담당도 '—'라 중복 방지).
    render(
      <QuoteTable
        rows={[
          makeRow({
            quoteAmount: null,
            owner: "ys1114@jinhakapply.com",
            quoteOwner: "ys1114@jinhakapply.com",
          }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
