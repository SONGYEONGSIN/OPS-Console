import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { useState } from "react";
import { ProjectForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

function Harness({ initialRow }: { initialRow: ListRow }) {
  const [row, setRow] = useState(initialRow);
  return (
    <ProjectForm
      row={row}
      setRow={setRow}
      onSave={vi.fn()}
      onCancel={vi.fn()}
    />
  );
}

describe("ProjectForm", () => {
  it("name/description/owner/시작/마감/우선순위/상태 입력 필드", () => {
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
        }}
      />,
    );
    expect(screen.getByLabelText("프로젝트명")).toBeInTheDocument();
    expect(screen.getByLabelText("설명")).toBeInTheDocument();
    expect(screen.getByLabelText("우선순위")).toBeInTheDocument();
    expect(screen.getByLabelText("상태")).toBeInTheDocument();
    expect(screen.getByLabelText("시작일")).toBeInTheDocument();
    expect(screen.getByLabelText("마감일")).toBeInTheDocument();
  });
});
