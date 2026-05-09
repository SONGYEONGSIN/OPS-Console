import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorListBody } from "../InspectorListBody";
import type { ListRow } from "../../patterns/ListPattern";

const fixture: ListRow = {
  id: "svc-pay-001",
  name: "결제 게이트웨이",
  status: "urgent",
  owner: "박현주",
};

describe("InspectorListBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorListBody row={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("svc-pay-001")).toBeInTheDocument();
    expect(screen.getByText("박현주")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit 모드 — input 노출", () => {
    render(
      <InspectorListBody row={fixture} editing={true} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByLabelText("이름")).toHaveValue("결제 게이트웨이");
    expect(screen.getByLabelText("담당")).toHaveValue("박현주");
  });

  it("저장 — onSave(next) 호출, next에 변경 반영", () => {
    const onSave = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "결제 GW v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, name: "결제 GW v2" });
  });

  it("취소 — onCancel 호출, onSave 호출 X", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
