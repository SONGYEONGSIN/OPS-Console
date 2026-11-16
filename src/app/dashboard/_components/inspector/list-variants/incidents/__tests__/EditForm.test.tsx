import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { IncidentEditForm } from "../EditForm";

describe("IncidentEditForm", () => {
  it("담당부서 select는 다른 입력창과 같은 기본 음영(bg-field-bg)이다", () => {
    const row = { id: "", name: "" } as unknown as ListRow;
    render(
      <IncidentEditForm
        row={row}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("담당부서");
    expect(select.className).toContain("bg-field-bg");
    expect(select.className).not.toContain("bg-washi");
    expect(select.className).toContain("cursor-not-allowed");
  });
});
