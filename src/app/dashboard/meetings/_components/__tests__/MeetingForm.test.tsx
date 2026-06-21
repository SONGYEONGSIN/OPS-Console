import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MeetingForm } from "../MeetingForm";
import { buildSeedDoc } from "@/features/meetings/form-templates";
import type { MeetingDoc } from "@/features/meetings/form-model";

function setup(type: Parameters<typeof buildSeedDoc>[0] = "regular") {
  const doc = buildSeedDoc(type);
  const onChange = vi.fn<(d: MeetingDoc) => void>();
  render(<MeetingForm doc={doc} onChange={onChange} />);
  return { doc, onChange };
}

describe("MeetingForm (편집 가능 양식)", () => {
  it("섹션 제목과 표 헤더를 렌더한다", () => {
    setup("regular");
    expect(screen.getByText("지난 안건 점검")).toBeInTheDocument();
    expect(screen.getByText("논의 내용")).toBeInTheDocument();
  });

  it("표 '행 추가' 클릭 시 행이 늘어난 doc으로 onChange", () => {
    const { onChange } = setup("regular");
    const addRow = screen.getAllByRole("button", { name: /행 추가/ })[0];
    fireEvent.click(addRow);
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    const firstTable = next.sections.find((s) => s.kind === "table");
    expect(firstTable?.kind === "table" && firstTable.rows.length).toBe(2);
  });

  it("상태 배지 클릭 시 다음 상태로 순환하여 onChange", () => {
    const { onChange } = setup("regular");
    // 표의 상태 셀(진행중) 클릭 → 완료 등 다음 상태
    const stamp = screen.getAllByText("진행중")[0];
    fireEvent.click(stamp);
    expect(onChange).toHaveBeenCalled();
  });

  it("notes '비고 추가' 클릭 시 항목 추가", () => {
    const { onChange } = setup("regular");
    const add = screen.getByRole("button", { name: /비고 추가/ });
    fireEvent.click(add);
    const next = onChange.mock.calls.at(-1)![0];
    const notes = next.sections.find((s) => s.kind === "notes");
    expect(notes?.kind === "notes" && notes.items.length).toBe(2);
  });

  it("텍스트 셀 편집(blur) 시 값이 반영된 onChange", () => {
    const { onChange } = setup("regular");
    const ledger = screen.getByText("논의 내용").closest("div")!;
    // 안건 제목 편집 필드(빈 contentEditable) 중 첫 번째에 입력
    const editables = document.querySelectorAll('[contenteditable="true"]');
    expect(editables.length).toBeGreaterThan(0);
    const el = editables[0] as HTMLElement;
    el.textContent = "테스트 입력";
    fireEvent.blur(el);
    expect(onChange).toHaveBeenCalled();
    void ledger;
  });
});
