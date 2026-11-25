import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { IncidentTable } from "../Table";

function makeRow(over: Partial<ListRow>): ListRow {
  return {
    id: crypto.randomUUID(),
    name: "사고",
    status: "active",
    owner: "",
    incidentStatus: "처리중",
    ...over,
  };
}

describe("IncidentTable 경위서 상태 배지", () => {
  it("경위서 상태 없음 → '없음'", () => {
    render(
      <IncidentTable
        rows={[makeRow({ incidentReportStatus: undefined })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("없음")).toBeInTheDocument();
  });

  it("draft → '작성 중', pending_approval → '승인대기', sent → '발송완료'", () => {
    render(
      <IncidentTable
        rows={[
          makeRow({ incidentReportStatus: "draft" }),
          makeRow({ incidentReportStatus: "pending_approval" }),
          makeRow({ incidentReportStatus: "sent" }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("작성 중")).toBeInTheDocument();
    expect(screen.getByText("승인대기")).toBeInTheDocument();
    expect(screen.getByText("발송완료")).toBeInTheDocument();
  });

  it("경위서 컬럼 헤더 노출", () => {
    render(
      <IncidentTable rows={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("경위서")).toBeInTheDocument();
  });
});

describe("IncidentTable 사고 등급 열", () => {
  it("등급 머리칸은 상태 바로 다음이다", () => {
    render(<IncidentTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    const i = headers.indexOf("상태");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(headers[i + 1]).toBe("등급");
  });

  it("등급 셀은 값을 평문으로, 없으면 — 를 보이고 모양은 text-xs text-ink-soft", () => {
    render(
      <IncidentTable
        rows={[
          makeRow({ incidentSeverity: "높음" }),
          makeRow({ incidentSeverity: null }),
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const headers = screen
      .getAllByRole("columnheader")
      .map((th) => th.textContent);
    const col = headers.indexOf("등급");
    const [, first, second] = screen.getAllByRole("row");
    const cell1 = within(first).getAllByRole("cell")[col];
    const cell2 = within(second).getAllByRole("cell")[col];
    expect(cell1).toHaveTextContent("높음");
    expect(cell2).toHaveTextContent("—");
    for (const cell of [cell1, cell2]) {
      expect(cell).toHaveClass(
        "whitespace-nowrap",
        "px-3",
        "py-2",
        "text-xs",
        "text-ink-soft",
      );
    }
  });

  it("빈 목록의 데이터 없음 칸은 colSpan 10", () => {
    render(<IncidentTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toHaveAttribute("colspan", "10");
  });
});
