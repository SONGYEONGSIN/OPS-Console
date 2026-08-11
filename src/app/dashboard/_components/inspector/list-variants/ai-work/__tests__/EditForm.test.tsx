import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiWorkForm } from "../EditForm";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "회의록 자동화",
  status: "active",
  owner: "홍길동",
  authorEmail: "hong@example.com",
};

describe("AiWorkForm — 삭제 버튼 권한 가드 (admin OR 본인)", () => {
  it("admin: 타인 작성건도 삭제 버튼 노출", () => {
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserEmail="admin@example.com"
        currentUserPermission="admin"
      />,
    );
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("본인 작성건: member도 삭제 버튼 노출", () => {
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserEmail="hong@example.com"
        currentUserPermission="member"
      />,
    );
    expect(screen.getByRole("button", { name: "삭제" })).toBeInTheDocument();
  });

  it("타인 작성건 + member: 삭제 버튼 미노출", () => {
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserEmail="other@example.com"
        currentUserPermission="member"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
  });

  it("신규 row (id 빈 문자열): admin이어도 삭제 버튼 미노출", () => {
    render(
      <AiWorkForm
        row={{ ...baseRow, id: "" }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserEmail="admin@example.com"
        currentUserPermission="admin"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "삭제" }),
    ).not.toBeInTheDocument();
  });

  it("삭제 클릭 → confirm 승인 시 onSave(row + status:deleted)", () => {
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
        currentUserEmail="hong@example.com"
        currentUserPermission="member"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onSave).toHaveBeenCalledWith({ ...baseRow, status: "deleted" });
    confirmSpy.mockRestore();
  });

  it("삭제 클릭 → confirm 거절 시 onSave 미호출", () => {
    const onSave = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <AiWorkForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
        currentUserEmail="hong@example.com"
        currentUserPermission="member"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onSave).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

const operators = [
  { email: "a@x.com", name: "김영희" },
  { email: "b@x.com", name: "박철수" },
];

function renderForm(row: ListRow, setRow = vi.fn()) {
  render(
    <AiWorkForm
      row={row}
      setRow={setRow}
      onSave={vi.fn()}
      onCancel={vi.fn()}
      currentUserEmail="hong@example.com"
      currentUserPermission="member"
      aiWorkOperators={operators}
    />,
  );
  return setRow;
}

describe("AiWorkForm — 공동작업자", () => {
  it("기본값은 '없음'이다", () => {
    renderForm(baseRow);
    const select = screen.getByLabelText("공동작업자") as HTMLSelectElement;
    expect(select.value).toBe("");
    expect(screen.getByRole("option", { name: "없음" })).toBeInTheDocument();
  });

  it("한 명 고르면 setRow에 이메일이 담긴다", () => {
    const setRow = renderForm(baseRow);
    fireEvent.change(screen.getByLabelText("공동작업자"), {
      target: { value: "a@x.com" },
    });
    expect(setRow).toHaveBeenCalledWith({
      ...baseRow,
      collaboratorEmails: ["a@x.com"],
    });
  });

  it("선택된 사람은 칩으로 보이고 옵션에서는 사라진다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["a@x.com"] });
    expect(screen.getByText("김영희")).toBeInTheDocument();
    expect(
      screen.queryByRole("option", { name: "김영희" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "박철수" })).toBeInTheDocument();
  });

  it("칩의 제거 버튼이 해당 이메일만 뺀다", () => {
    const setRow = renderForm({
      ...baseRow,
      collaboratorEmails: ["a@x.com", "b@x.com"],
    });
    fireEvent.click(screen.getByRole("button", { name: "김영희 제외" }));
    expect(setRow).toHaveBeenCalledWith({
      ...baseRow,
      collaboratorEmails: ["b@x.com"],
    });
  });

  it("후보를 모두 고르면 셀렉트가 비활성된다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["a@x.com", "b@x.com"] });
    expect(screen.getByLabelText("공동작업자")).toBeDisabled();
  });

  it("후보에 없는 이메일(퇴사자)도 칩으로 유지한다", () => {
    renderForm({ ...baseRow, collaboratorEmails: ["gone@x.com"] });
    expect(screen.getByText("gone")).toBeInTheDocument();
  });
});
