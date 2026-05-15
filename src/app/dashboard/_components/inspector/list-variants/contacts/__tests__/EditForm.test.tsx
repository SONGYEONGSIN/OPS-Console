import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ContactsForm } from "../EditForm";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "김지나",
  status: "active",
  owner: "",
  customerActive: "재직",
  jobTitle: "팀장",
  universityName: "가천대학교",
  departmentName: "입학팀",
  jobRole: "실무자",
  managementGrade: "A",
  relationshipGrade: "우호적",
  contactPhone: "010-1234-5678",
  contactExt: "031-750-1234",
  contactEmail: "kjn@gachon.ac.kr",
};

describe("ContactsForm", () => {
  it("11 필드 input 노출 + value", () => {
    render(
      <ContactsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("고객명")).toHaveValue("김지나");
    expect(screen.getByLabelText("대학명")).toHaveValue("가천대학교");
    expect(screen.getByLabelText("이메일")).toHaveValue("kjn@gachon.ac.kr");
  });

  it("저장 → onSave(row) 호출", () => {
    const onSave = vi.fn();
    render(
      <ContactsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 → onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <ContactsForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("신규 row(id='') — 삭제 버튼 미노출", () => {
    render(
      <ContactsForm
        row={{ ...baseRow, id: "" }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });
});
