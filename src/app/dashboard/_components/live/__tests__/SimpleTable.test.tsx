import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { SimpleTable } from "../SimpleTable";

describe("SimpleTable", () => {
  const columns = [
    { key: "date" as const, label: "마감", width: "w-24" },
    { key: "title" as const, label: "대학·서비스" },
  ];
  const rows = [
    { id: "a", date: "5.20", title: "건국·정시" },
    { id: "b", date: "5.21", title: "서울·추합" },
  ];

  it("헤더 + row 렌더", () => {
    render(<SimpleTable columns={columns} rows={rows} onRowClick={vi.fn()} />);
    expect(screen.getByText("마감")).toBeInTheDocument();
    expect(screen.getByText("대학·서비스")).toBeInTheDocument();
    expect(screen.getByText("건국·정시")).toBeInTheDocument();
    expect(screen.getByText("서울·추합")).toBeInTheDocument();
  });

  it("row 클릭 → onRowClick(rowId)", () => {
    const handler = vi.fn();
    render(<SimpleTable columns={columns} rows={rows} onRowClick={handler} />);
    fireEvent.click(screen.getByText("건국·정시"));
    expect(handler).toHaveBeenCalledWith("a");
  });

  it("selectedId 일치 row 강조", () => {
    render(
      <SimpleTable columns={columns} rows={rows} selectedId="b" onRowClick={vi.fn()} />,
    );
    const selectedRow = screen.getByText("서울·추합").closest("tr");
    expect(selectedRow?.className).toMatch(/washi-raised/);
  });

  it("빈 rows — 안내 텍스트", () => {
    render(<SimpleTable columns={columns} rows={[]} onRowClick={vi.fn()} />);
    expect(screen.getByText(/데이터 없음/)).toBeInTheDocument();
  });
});
