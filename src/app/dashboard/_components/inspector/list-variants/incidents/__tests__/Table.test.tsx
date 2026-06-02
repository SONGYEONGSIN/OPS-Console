import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
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

  it("draft → '작성중', pending_approval → '승인대기', sent → '발송완료'", () => {
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
    expect(screen.getByText("작성중")).toBeInTheDocument();
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
