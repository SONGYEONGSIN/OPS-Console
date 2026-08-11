import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiWorkTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "회의록 자동화",
  status: "active",
  owner: "송영신",
};

describe("AiWorkTable — 등록자 칸", () => {
  it("공동작업자가 있으면 쉼표로 이어 붙인다", () => {
    render(
      <AiWorkTable
        rows={[{ ...baseRow, collaboratorNames: ["홍길동", "김영희"] }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("송영신, 홍길동, 김영희")).toBeInTheDocument();
  });

  it("공동작업자가 없으면 등록자만 보인다", () => {
    render(
      <AiWorkTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });

  it("빈 배열도 등록자만 보인다", () => {
    render(
      <AiWorkTable
        rows={[{ ...baseRow, collaboratorNames: [] }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });
});
