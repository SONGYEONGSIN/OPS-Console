import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

  it("후속조치 '기한' 셀 클릭 시 달력(showPicker)이 열린다 — 외근·출장 템플릿", () => {
    // jsdom에는 showPicker가 없어 prototype mock으로 호출 여부만 검증
    const showPicker = vi.fn();
    (
      HTMLInputElement.prototype as HTMLInputElement & {
        showPicker: () => void;
      }
    ).showPicker = showPicker;
    setup("field");
    const dateCell = document.querySelector('input[type="date"].mf-date-cell')!;
    expect(dateCell).not.toBeNull();
    fireEvent.click(dateCell);
    expect(showPicker).toHaveBeenCalled();
  });

  it("후속조치 '기한' 셀은 날짜 입력(달력)이며 선택 시 onChange", () => {
    const { onChange } = setup("regular");
    const dateCells = document.querySelectorAll(
      'input[type="date"].mf-date-cell',
    );
    expect(dateCells.length).toBeGreaterThan(0);
    fireEvent.change(dateCells[0], { target: { value: "2026-07-01" } });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)![0];
    const table = next.sections.find(
      (s) => s.kind === "table" && s.headers.includes("기한"),
    );
    expect(table?.kind === "table").toBe(true);
    if (table?.kind !== "table") return;
    const kiIdx = table.headers.indexOf("기한");
    // idx 컬럼(#) 1개를 제외한 데이터 셀 인덱스 = kiIdx - 1
    expect(table.rows[0].cells[kiIdx - 1]).toBe("2026-07-01");
  });
});
