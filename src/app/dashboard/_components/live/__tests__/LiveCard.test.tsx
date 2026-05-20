import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { LiveCard } from "../LiveCard";
import type { SimpleColumn } from "../SimpleTable";

const columns: SimpleColumn[] = [
  { key: "date", label: "마감", width: "w-20" },
  { key: "title", label: "대학·서비스" },
];

describe("LiveCard", () => {
  it("라벨 + 카운트 + mini-table 노출", () => {
    render(
      <LiveCard
        label="서비스"
        count={2511}
        columns={columns}
        rows={[{ id: "a", date: "5.20", title: "건국·정시" }]}
        onRowClick={vi.fn()}
      />,
    );
    expect(screen.getByText("서비스")).toBeInTheDocument();
    expect(screen.getByText("2,511")).toBeInTheDocument();
    expect(screen.getByText("건국·정시")).toBeInTheDocument();
  });

  it("row 클릭 → onRowClick", () => {
    const handler = vi.fn();
    render(
      <LiveCard
        label="서비스"
        count={1}
        columns={columns}
        rows={[{ id: "a", date: "5.20", title: "건국·정시" }]}
        onRowClick={handler}
      />,
    );
    fireEvent.click(screen.getByText("건국·정시"));
    expect(handler).toHaveBeenCalledWith("a");
  });

  it("placeholder=true — 빈 슬롯 노출", () => {
    render(<LiveCard placeholder />);
    expect(screen.getByText(/도메인 추가 자리/)).toBeInTheDocument();
  });
});
