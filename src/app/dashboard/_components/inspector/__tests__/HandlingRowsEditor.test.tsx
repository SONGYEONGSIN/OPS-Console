import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { HandlingRowsEditor } from "../HandlingRowsEditor";

describe("HandlingRowsEditor", () => {
  it("'+ 처리 행 추가' 클릭 시 빈 행을 추가한다", () => {
    const onChange = vi.fn();
    render(<HandlingRowsEditor rows={[]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "+ 처리 행 추가" }));
    expect(onChange).toHaveBeenCalledWith([{ time: "", content: "" }]);
  });

  it("내용 칸은 textarea라 줄바꿈을 담는다 (항목2a)", () => {
    const onChange = vi.fn();
    render(
      <HandlingRowsEditor
        rows={[{ time: "", content: "" }]}
        onChange={onChange}
      />,
    );
    const content = screen.getByLabelText("처리 내용 1");
    expect(content.tagName).toBe("TEXTAREA");
    fireEvent.change(content, { target: { value: "줄1\n줄2" } });
    expect(onChange).toHaveBeenCalledWith([{ time: "", content: "줄1\n줄2" }]);
  });

  it("시간 칸은 datetime-local 달력+시간 선택기이고 입력을 반영한다", () => {
    const onChange = vi.fn();
    render(
      <HandlingRowsEditor
        rows={[{ time: "", content: "" }]}
        onChange={onChange}
      />,
    );
    const time = screen.getByLabelText("처리 시간 1") as HTMLInputElement;
    expect(time.tagName).toBe("INPUT");
    expect(time.type).toBe("datetime-local");
    fireEvent.change(time, { target: { value: "2026-06-19T14:27" } });
    expect(onChange).toHaveBeenCalledWith([
      { time: "2026-06-19T14:27", content: "" },
    ]);
  });

  it("✕ 클릭 시 해당 행을 제거한다", () => {
    const onChange = vi.fn();
    render(
      <HandlingRowsEditor
        rows={[
          { time: "a", content: "b" },
          { time: "c", content: "d" },
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByLabelText("처리 행 삭제 1"));
    expect(onChange).toHaveBeenCalledWith([{ time: "c", content: "d" }]);
  });
  it("시간·내용 칸은 표준 입력창 음영(bg-field-bg, border-line-soft)이다", () => {
    render(
      <HandlingRowsEditor
        rows={[{ time: "", content: "" }]}
        onChange={vi.fn()}
      />,
    );
    for (const label of ["처리 시간 1", "처리 내용 1"]) {
      const el = screen.getByLabelText(label);
      expect(el.className).toContain("bg-field-bg");
      expect(el.className).toContain("border-line-soft");
      expect(el.className).not.toContain("bg-cream");
    }
  });

  it("내용 칸 높이가 scrollHeight를 따라간다", () => {
    const spy = vi
      .spyOn(HTMLTextAreaElement.prototype, "scrollHeight", "get")
      .mockReturnValue(88);
    const { rerender } = render(
      <HandlingRowsEditor
        rows={[{ time: "", content: "줄1" }]}
        onChange={vi.fn()}
      />,
    );
    const content = screen.getByLabelText("처리 내용 1") as HTMLTextAreaElement;
    expect(content.style.height).toBe("88px");
    spy.mockReturnValue(132);
    fireEvent.change(content, { target: { value: "줄1\n줄2\n줄3" } });
    expect(content.style.height).toBe("132px");
    spy.mockReturnValue(60);
    rerender(
      <HandlingRowsEditor
        rows={[{ time: "", content: "줄" }]}
        onChange={vi.fn()}
      />,
    );
    expect(content.style.height).toBe("60px");
    spy.mockRestore();
  });
});
