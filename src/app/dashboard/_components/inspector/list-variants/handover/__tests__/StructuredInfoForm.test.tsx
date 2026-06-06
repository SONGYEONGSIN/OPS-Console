import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StructuredInfoForm } from "../StructuredInfoForm";

const fields = [
  { key: "deadline", label: "정산기한", placeholder: "예: 5영업일 이내" },
  { key: "manager", label: "담당자", placeholder: "예: ○○○" },
];

describe("StructuredInfoForm", () => {
  it("readOnly — 필드 값과 메모 표시", () => {
    render(
      <StructuredInfoForm
        fields={fields}
        value={{ deadline: "5영업일 이내", manager: "송영신", memo: "비고" }}
        readOnly
      />,
    );
    expect(screen.getByText("5영업일 이내")).toBeInTheDocument();
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("비고")).toBeInTheDocument();
  });

  it("편집 — 필드 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(
      <StructuredInfoForm
        fields={fields}
        value={{ deadline: "", manager: "", memo: "" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("담당자"), {
      target: { value: "임종우" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ manager: "임종우" });
  });

  it("편집 — 메모 입력 시 onChange로 갱신", () => {
    const onChange = vi.fn();
    render(
      <StructuredInfoForm
        fields={fields}
        value={{ deadline: "", manager: "", memo: "" }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByLabelText("메모"), {
      target: { value: "변경" },
    });
    expect(onChange.mock.calls[0][0]).toMatchObject({ memo: "변경" });
  });

  it("options 지정 필드는 셀렉트로 렌더 + 선택 시 onChange", () => {
    const onChange = vi.fn();
    render(
      <StructuredInfoForm
        fields={[
          { key: "deadline", label: "정산기한", options: ["5일 이내", "10일 이내"] },
        ]}
        value={{ deadline: "", memo: "" }}
        onChange={onChange}
      />,
    );
    const sel = screen.getByLabelText("정산기한") as HTMLSelectElement;
    expect(sel.tagName).toBe("SELECT");
    expect(Array.from(sel.options).map((o) => o.value)).toEqual([
      "",
      "5일 이내",
      "10일 이내",
    ]);
    fireEvent.change(sel, { target: { value: "10일 이내" } });
    expect(onChange.mock.calls[0][0]).toMatchObject({ deadline: "10일 이내" });
  });

  it("readOnly — 입력 필드 없음", () => {
    render(
      <StructuredInfoForm
        fields={fields}
        value={{ deadline: "", manager: "", memo: "" }}
        readOnly
      />,
    );
    expect(screen.queryByLabelText("담당자")).toBeNull();
  });
});
