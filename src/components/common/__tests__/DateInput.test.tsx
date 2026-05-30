import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { DateInput } from "../DateInput";

/** showPicker는 lib.dom typing에 추가됐지만 jsdom 미구현 — prototype 조작용 헬퍼 */
type ShowPickerProto = { showPicker?: () => void };
const proto = HTMLInputElement.prototype as unknown as ShowPickerProto;

describe("DateInput", () => {
  it("type 미지정 시 'date'로 렌더", () => {
    render(<DateInput aria-label="마감일" />);
    const input = screen.getByLabelText("마감일") as HTMLInputElement;
    expect(input.type).toBe("date");
  });

  it("type='datetime-local' 전달 시 그대로 렌더", () => {
    render(<DateInput aria-label="예약 시각" type="datetime-local" />);
    const input = screen.getByLabelText("예약 시각") as HTMLInputElement;
    expect(input.type).toBe("datetime-local");
  });

  it("input 클릭 시 showPicker 호출 (Chrome 칸 어디든 picker 열림)", () => {
    const showPicker = vi.fn();
    const original = proto.showPicker;
    proto.showPicker = showPicker;

    render(<DateInput aria-label="마감일" />);
    const input = screen.getByLabelText("마감일");
    fireEvent.click(input);

    expect(showPicker).toHaveBeenCalledTimes(1);

    proto.showPicker = original;
  });

  it("사용자 onClick 핸들러도 함께 호출 (체이닝)", () => {
    const userClick = vi.fn();
    render(<DateInput aria-label="마감일" onClick={userClick} />);
    fireEvent.click(screen.getByLabelText("마감일"));
    expect(userClick).toHaveBeenCalledTimes(1);
  });

  it("value/onChange/className 등 일반 input props 통과", () => {
    const onChange = vi.fn();
    render(
      <DateInput
        aria-label="마감일"
        value="2026-05-28"
        onChange={onChange}
        className="custom-class"
      />,
    );
    const input = screen.getByLabelText("마감일") as HTMLInputElement;
    expect(input.value).toBe("2026-05-28");
    expect(input.className).toContain("custom-class");
    fireEvent.change(input, { target: { value: "2026-06-01" } });
    expect(onChange).toHaveBeenCalled();
  });

  it("showPicker 미지원 브라우저 — 클릭 시 throw 없음", () => {
    const original = proto.showPicker;
    delete proto.showPicker;

    render(<DateInput aria-label="마감일" />);
    expect(() =>
      fireEvent.click(screen.getByLabelText("마감일")),
    ).not.toThrow();

    if (original) proto.showPicker = original;
  });
});
