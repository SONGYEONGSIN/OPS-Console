import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiWorkView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "회의록 자동화",
  status: "active",
  owner: "송영신",
};

describe("AiWorkView — 공동작업자", () => {
  it("이름을 쉼표로 나열한다", () => {
    render(
      <AiWorkView
        row={{ ...baseRow, collaboratorNames: ["홍길동", "김영희"] }}
      />,
    );
    expect(screen.getByText("공동작업자")).toBeInTheDocument();
    expect(screen.getByText("홍길동, 김영희")).toBeInTheDocument();
  });

  it("없으면 '없음'으로 표시한다", () => {
    render(<AiWorkView row={baseRow} />);
    expect(screen.getByText("공동작업자")).toBeInTheDocument();
    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
