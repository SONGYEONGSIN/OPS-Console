import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useState } from "react";
import { WeeklyTodoForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

function Harness({ initialRow }: { initialRow: ListRow }) {
  const [row, setRow] = useState(initialRow);
  return (
    <WeeklyTodoForm
      row={row}
      setRow={setRow}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "",
    name: "",
    status: "active",
    owner: "",
    priority: "medium",
    done: false,
    category: undefined,
    progress: 0,
    todoStatus: "todo",
    ...over,
  };
}

describe("WeeklyTodoForm", () => {
  it("제목/카테고리/우선순위/상태/진행률 입력 필드", () => {
    render(<Harness initialRow={makeRow()} />);
    expect(screen.getByLabelText("제목")).toBeInTheDocument();
    expect(screen.getByLabelText("카테고리")).toBeInTheDocument();
    expect(screen.getByLabelText("우선순위")).toBeInTheDocument();
    expect(screen.getByLabelText("상태")).toBeInTheDocument();
    expect(screen.getByLabelText("진행률")).toBeInTheDocument();
  });

  it("카테고리 입력 → row.category 갱신 (controlled)", () => {
    render(<Harness initialRow={makeRow()} />);
    const input = screen.getByLabelText("카테고리") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "신제품 프로모션" } });
    expect(input.value).toBe("신제품 프로모션");
  });
});
