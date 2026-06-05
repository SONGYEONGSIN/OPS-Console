import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContractInfoForm } from "../ContractInfoForm";
import type { ContractInfo } from "@/features/handover/schemas";

const value: ContractInfo = {
  title: "원서접수",
  type: "수의",
  progress: "운영자",
  status: "완료",
  memo: "※ 학부 계약시 포함",
};

describe("ContractInfoForm", () => {
  it("readOnly — 제목/형태/진행/상태/메모 값 표시", () => {
    render(<ContractInfoForm value={value} readOnly />);
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("수의")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("완료")).toBeInTheDocument();
    expect(screen.getByText("※ 학부 계약시 포함")).toBeInTheDocument();
  });

  it("편집 — 형태 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(<ContractInfoForm value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("형태"), {
      target: { value: "공개" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ type: "공개" });
  });

  it("편집 — 메모 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(<ContractInfoForm value={value} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("계약정보 메모"), {
      target: { value: "변경 메모" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ memo: "변경 메모" });
  });

  it("readOnly — 입력 필드 없음", () => {
    render(<ContractInfoForm value={value} readOnly />);
    expect(screen.queryByLabelText("형태")).toBeNull();
  });
});
