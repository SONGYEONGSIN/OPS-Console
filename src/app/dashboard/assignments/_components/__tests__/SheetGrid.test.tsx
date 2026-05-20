import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { AssignmentSheet } from "@/features/assignments/schemas";
import { SheetGrid } from "../SheetGrid";

const makeSheet = (overrides: Partial<AssignmentSheet> = {}): AssignmentSheet => ({
  worksheetName: "원서접수",
  rowsText: [
    ["대학명", "운영자", "개발자"],
    ["가천대학교", "홍길동", "이순신"],
  ],
  rowCount: 2,
  columnCount: 3,
  ...overrides,
});

describe("SheetGrid", () => {
  it("rowsText 행 수만큼 tr 렌더", () => {
    render(<SheetGrid sheet={makeSheet()} />);
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(2);
  });

  it("각 행의 셀 텍스트 렌더 — 헤더 셀", () => {
    render(<SheetGrid sheet={makeSheet()} />);
    expect(screen.getByText("대학명")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("개발자")).toBeInTheDocument();
  });

  it("각 행의 셀 텍스트 렌더 — 데이터 셀", () => {
    render(<SheetGrid sheet={makeSheet()} />);
    expect(screen.getByText("가천대학교")).toBeInTheDocument();
    expect(screen.getByText("홍길동")).toBeInTheDocument();
    expect(screen.getByText("이순신")).toBeInTheDocument();
  });

  it("columnCount 기준 td 개수 — 행 1개 × 3열", () => {
    const sheet = makeSheet({
      rowsText: [["A", "B", "C"]],
      rowCount: 1,
      columnCount: 3,
    });
    render(<SheetGrid sheet={sheet} />);
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(3);
  });

  it("rowsText 열 수 < columnCount — 빈 셀로 패딩", () => {
    const sheet = makeSheet({
      rowsText: [["가천대학교"]],
      rowCount: 1,
      columnCount: 3,
    });
    render(<SheetGrid sheet={sheet} />);
    // 3개 td 렌더되어야 함
    const cells = screen.getAllByRole("cell");
    expect(cells).toHaveLength(3);
  });
});
