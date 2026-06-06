import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ContractChecklist } from "../ContractChecklist";

const items = [
  { id: "a", text: "계약서", done: true },
  { id: "b", text: "사업자등록증", done: false },
];

describe("ContractChecklist", () => {
  it("헤더에 완료/전체 카운트 표시", () => {
    render(<ContractChecklist items={items} readOnly />);
    expect(screen.getByText(/계약서류/)).toBeInTheDocument();
    expect(screen.getByText(/완료 1\/2/)).toBeInTheDocument();
  });

  it("label 지정 시 헤더 라벨 변경", () => {
    render(<ContractChecklist items={[]} label="제출서류" readOnly />);
    expect(screen.getByText("제출서류")).toBeInTheDocument();
    expect(
      screen.getByText("등록된 제출서류 항목이 없습니다."),
    ).toBeInTheDocument();
  });

  it("readOnly — 체크/항목 텍스트 표시, 입력 없음", () => {
    render(<ContractChecklist items={items} readOnly />);
    expect(screen.getByText("계약서")).toBeInTheDocument();
    expect(screen.getByText("사업자등록증")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("체크 항목")).toBeNull();
  });

  it("편집 — 항목 추가 시 onChange로 새 항목", () => {
    const onChange = vi.fn();
    render(<ContractChecklist items={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /항목 추가/ }));
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });

  it("편집 — 체크 토글 시 done 변경", () => {
    const onChange = vi.fn();
    render(<ContractChecklist items={items} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("항목 2 완료"));
    expect(onChange.mock.calls[0][0][1].done).toBe(true);
  });

  it("편집 — 삭제 시 항목 제거", () => {
    const onChange = vi.fn();
    render(<ContractChecklist items={items} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText("항목 1 삭제"));
    expect(onChange.mock.calls[0][0]).toHaveLength(1);
  });
});
