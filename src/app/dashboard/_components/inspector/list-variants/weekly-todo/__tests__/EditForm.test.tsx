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

  it("카테고리 select preset 선택 → row.category 갱신", () => {
    render(<Harness initialRow={makeRow()} />);
    const select = screen.getByLabelText("카테고리") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "원서접수" } });
    expect(select.value).toBe("원서접수");
  });

  it("카테고리 '기타' 선택 시 직접 입력 input 노출 → 자유 입력 가능", () => {
    render(<Harness initialRow={makeRow()} />);
    const select = screen.getByLabelText("카테고리") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "기타" } });
    const custom = screen.getByLabelText(
      "카테고리 직접 입력",
    ) as HTMLInputElement;
    fireEvent.change(custom, { target: { value: "신제품 프로모션" } });
    expect(custom.value).toBe("신제품 프로모션");
  });

  it("기존 row.category가 preset 외 값이면 '기타' 자동 선택 + 입력란에 채움", () => {
    render(
      <Harness
        initialRow={makeRow({ category: "2단계 전형료결제(테스트)" })}
      />,
    );
    const select = screen.getByLabelText("카테고리") as HTMLSelectElement;
    expect(select.value).toBe("기타");
    const custom = screen.getByLabelText(
      "카테고리 직접 입력",
    ) as HTMLInputElement;
    expect(custom.value).toBe("2단계 전형료결제(테스트)");
  });
});
