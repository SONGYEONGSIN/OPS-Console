import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BackupForm } from "../EditForm";
import type { ListRow } from "../../../../patterns/ListPattern";

const baseRow: ListRow = {
  id: "",
  name: "",
  status: "active",
  owner: "Bob",
  substituteEmail: "",
  substituteName: "",
  backupServices: [],
  backupContacts: [],
  leaveStartDate: null,
  leaveEndDate: null,
  mailStatus: "pending",
  summary: "",
};

describe("BackupForm", () => {
  it("필드 입력 시 setRow 호출 (요약)", () => {
    const setRow = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={setRow}
        onSave={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("백업 내용"), {
      target: { value: "내용" },
    });
    expect(setRow).toHaveBeenCalled();
  });

  it("저장 버튼 클릭 시 onSave(row) 호출", () => {
    const onSave = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={onSave}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 버튼 클릭 시 onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("백업자 select 변경 시 substituteEmail + substituteName 둘 다 설정", () => {
    const setRow = vi.fn();
    const operators = [
      { email: "alice@example.com", name: "Alice" },
      { email: "carol@example.com", name: "Carol" },
    ];
    render(
      <BackupForm
        row={baseRow}
        setRow={setRow}
        onSave={() => {}}
        onCancel={() => {}}
        backupOperators={operators}
      />,
    );
    fireEvent.change(screen.getByLabelText("백업자"), {
      target: { value: "alice@example.com" },
    });
    expect(setRow).toHaveBeenCalledWith(
      expect.objectContaining({
        substituteEmail: "alice@example.com",
        substituteName: "Alice",
      }),
    );
  });

  it("빈 backupOperators 시 placeholder만 노출", () => {
    render(
      <BackupForm
        row={baseRow}
        setRow={() => {}}
        onSave={() => {}}
        onCancel={() => {}}
        backupOperators={[]}
      />,
    );
    const select = screen.getByLabelText("백업자") as HTMLSelectElement;
    expect(select.options.length).toBe(1);
    expect(select.options[0].textContent).toContain("선택");
  });
});
