import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { ReceivablesView } from "../../list-variants/receivables/View";
import { ReceivablesForm } from "../../list-variants/receivables/EditForm";

const baseRow: ListRow = {
  id: "rec-001",
  name: "서울고등학교",
  status: "active",
  owner: "박현주",
  meta: "2026-03-01",
  author: "₩1,200,000",
  receivablesCells: {
    headers: ["거래처", "청구일자", "청구금액", "학교담당자", "적요"],
    textValues: [
      "서울고등학교",
      "2026-03-01",
      "₩1,200,000",
      "manager@seoul.hs.kr",
      "",
    ],
    remarksHeaderIdx: 4,
    dueDateHeaderIdx: -1,
    schoolOwnerHeaderIdx: 3,
    remarks: "",
    schoolOwner: "manager@seoul.hs.kr",
  },
};

describe("ReceivablesView", () => {
  it("기본 정보 — 거래처/청구일자/금액 표시", () => {
    render(<ReceivablesView row={baseRow} />);
    expect(screen.getAllByText("서울고등학교").length).toBeGreaterThan(0);
    expect(screen.getAllByText("2026-03-01").length).toBeGreaterThan(0);
    expect(screen.getAllByText("₩1,200,000").length).toBeGreaterThan(0);
  });

  it("미수 — 입금여부 라벨", () => {
    render(<ReceivablesView row={baseRow} />);
    expect(screen.getByText("미수")).toBeInTheDocument();
  });

  it("수금 — status=approved 시 라벨 전환", () => {
    render(<ReceivablesView row={{ ...baseRow, status: "approved" }} />);
    expect(screen.getByText("수금")).toBeInTheDocument();
  });

  it("admin + 학교담당자 이메일 존재 시 — 독려 메일 버튼 노출", () => {
    render(<ReceivablesView row={baseRow} currentUserPermission="admin" />);
    expect(
      screen.getByRole("button", { name: /독려 메일/ }),
    ).toBeInTheDocument();
  });

  it("admin 아닌 경우 — 메일 버튼 미노출", () => {
    render(<ReceivablesView row={baseRow} currentUserPermission="member" />);
    expect(screen.queryByRole("button", { name: /독려 메일/ })).toBeNull();
  });

  it("입금 완료 적요 — 메일 버튼 미노출", () => {
    render(
      <ReceivablesView
        row={{
          ...baseRow,
          receivablesCells: { ...baseRow.receivablesCells!, remarks: "입금 완료" },
        }}
        currentUserPermission="admin"
      />,
    );
    expect(screen.queryByRole("button", { name: /독려 메일/ })).toBeNull();
  });
});

describe("ReceivablesForm", () => {
  it("편집 가능 필드 — 적요(textarea) + 학교담당자(email) 노출", () => {
    render(
      <ReceivablesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("적요")).toBeInTheDocument();
    expect(screen.getByLabelText("학교담당자")).toHaveValue(
      "manager@seoul.hs.kr",
    );
  });

  it("저장 — onSave 호출", () => {
    const onSave = vi.fn();
    render(
      <ReceivablesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(baseRow);
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <ReceivablesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("이메일 형식 오류 — 경고 메시지", () => {
    render(
      <ReceivablesForm
        row={{
          ...baseRow,
          receivablesCells: {
            ...baseRow.receivablesCells!,
            schoolOwner: "not-email",
            textValues: [
              "서울고등학교",
              "2026-03-01",
              "₩1,200,000",
              "not-email",
              "",
            ],
          },
        }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText(/이메일 형식이 올바르지 않습니다/)).toBeInTheDocument();
  });

  it("receivablesCells 미존재 — 안내 표시", () => {
    render(
      <ReceivablesForm
        row={{ ...baseRow, receivablesCells: undefined }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.getByText("편집 가능한 셀 정보가 없습니다."),
    ).toBeInTheDocument();
  });
});
