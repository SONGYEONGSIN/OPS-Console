import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContractsEditForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "4년제-12",
  name: "한국예술종합학교",
  status: "active",
  owner: "기자의",
  numbering: "D-1-01",
  contractStatus: "미완료",
  serviceActive: "Y",
  feeAmount: "5,000",
  contractsSheet: "4년제",
  contractsCellOperator: "F12",
  contractsCellStatus: "G12",
  contractsCellServiceActive: "H12",
  contractsCellFeeAmount: "I12",
};

function setup(over: Partial<Parameters<typeof ContractsEditForm>[0]> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const setRow = vi.fn();
  render(
    <ContractsEditForm
      row={baseRow}
      setRow={setRow}
      onSave={onSave}
      onCancel={onCancel}
      {...over}
    />,
  );
  return { onSave, onCancel, setRow };
}

describe("ContractsEditForm", () => {
  it("4 input 표시 + 기존 값 prefill", () => {
    setup();
    expect(screen.getByLabelText("운영자")).toHaveValue("기자의");
    expect(screen.getByLabelText("계약진행현황")).toHaveValue("미완료");
    expect(screen.getByLabelText("서비스여부")).toHaveValue("Y");
    expect(screen.getByLabelText("수수료(VAT포함)")).toHaveValue("5,000");
  });

  it("저장 클릭 시 onSave(row) 호출", () => {
    const { onSave } = setup();
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalled();
  });

  it("취소 클릭 시 onCancel 호출", () => {
    const { onCancel } = setup();
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("input 변경 시 setRow 호출", () => {
    const { setRow } = setup();
    fireEvent.change(screen.getByLabelText("운영자"), {
      target: { value: "송영신" },
    });
    expect(setRow).toHaveBeenCalled();
  });

  it("cellAddress null인 필드는 readOnly", () => {
    setup({
      row: { ...baseRow, contractsCellOperator: null },
    });
    expect(screen.getByLabelText("운영자")).toHaveAttribute("readonly");
  });
});
