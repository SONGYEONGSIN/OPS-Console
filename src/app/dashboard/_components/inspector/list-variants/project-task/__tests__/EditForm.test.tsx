import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { ProjectTaskForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

function Harness({ initialRow }: { initialRow: ListRow }) {
  const [row, setRow] = useState(initialRow);
  return (
    <ProjectTaskForm
      row={row}
      setRow={setRow}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

describe("ProjectTaskForm", () => {
  it("name/담당/기간/우선순위/상태 입력 필드", () => {
    render(
      <Harness
        initialRow={{
          id: "",
          name: "",
          status: "active",
          owner: "",
          priority: "medium",
          progress: 0,
          todoStatus: "todo",
          projectId: "11111111-1111-4111-8111-111111111111",
        }}
      />,
    );
    expect(screen.getByLabelText("하위 업무명")).toBeInTheDocument();
    expect(screen.getByLabelText("담당자")).toBeInTheDocument();
    expect(screen.getByLabelText("시작일")).toBeInTheDocument();
    expect(screen.getByLabelText("마감일")).toBeInTheDocument();
    expect(screen.getByLabelText("우선순위")).toBeInTheDocument();
    expect(screen.getByLabelText("상태")).toBeInTheDocument();
  });
});
