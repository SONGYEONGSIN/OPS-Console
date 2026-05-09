import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorImprovementBody } from "../InspectorImprovementBody";
import type { ProjectImprovement } from "../../patterns/ProjectPattern";

const fixture: ProjectImprovement = {
  title: "결제 시스템 v2 마이그레이션",
  pm: "박현주",
  due: "2026-06-30",
  status: "run",
};

describe("InspectorImprovementBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorImprovementBody
        improvement={fixture}
        editing={false}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("결제 시스템 v2 마이그레이션")).toBeInTheDocument();
    expect(screen.getByText("박현주")).toBeInTheDocument();
    expect(screen.getByText("2026-06-30")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit + 저장 — onSave(next) 호출", () => {
    const onSave = vi.fn();
    render(
      <InspectorImprovementBody
        improvement={fixture}
        editing={true}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("제목"), {
      target: { value: "결제 v3" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, title: "결제 v3" });
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <InspectorImprovementBody
        improvement={fixture}
        editing={true}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
