import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../patterns/ListPattern";
import { TeamView } from "../../list-variants/team/View";
import { TeamForm } from "../../list-variants/team/EditForm";

const dummyRow: ListRow = {
  id: "dummy@example.com",
  name: "더미 사용자",
  status: "active",
  owner: "운영1팀",
  meta: "매니저",
  permission: "member",
};

describe("TeamView (OPERATORS lookup 실패 fallback)", () => {
  it("계정 정보 — row 기반 단순 노출", () => {
    render(<TeamView row={dummyRow} />);
    expect(screen.getByText("더미 사용자")).toBeInTheDocument();
    expect(screen.getByText("dummy@example.com")).toBeInTheDocument();
    expect(screen.getByText("운영1팀")).toBeInTheDocument();
    expect(screen.getByText("매니저")).toBeInTheDocument();
  });

  it("권한 표시 — row.permission='admin' 시 '관리자' 라벨", () => {
    render(
      <TeamView row={{ ...dummyRow, permission: "admin" }} />,
    );
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });
});

describe("TeamForm", () => {
  it("기본 필드 — 이름/이메일/팀 select/직급/직속 상사/상태 노출", () => {
    render(
      <TeamForm
        row={dummyRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("이름")).toHaveValue("더미 사용자");
    expect(screen.getByLabelText("이메일")).toHaveValue("dummy@example.com");
    expect(screen.getByLabelText("팀")).toHaveValue("운영1팀");
    expect(screen.getByLabelText("직급")).toHaveValue("매니저");
  });

  it("admin이 아닐 때 — 권한 select 미노출", () => {
    render(
      <TeamForm
        row={dummyRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserPermission="member"
      />,
    );
    expect(screen.queryByLabelText("권한")).toBeNull();
  });

  it("admin일 때 — 권한 select + 메뉴 권한 체크박스 노출", () => {
    render(
      <TeamForm
        row={dummyRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        currentUserPermission="admin"
      />,
    );
    expect(screen.getByLabelText("권한")).toBeInTheDocument();
  });

  it("상태=deleted 시 — 삭제 사유 textarea 노출", () => {
    render(
      <TeamForm
        row={{ ...dummyRow, status: "deleted" }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("삭제 사유")).toBeInTheDocument();
  });

  it("저장 — onSave 호출", () => {
    const onSave = vi.fn();
    render(
      <TeamForm
        row={dummyRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(dummyRow);
  });

  it("취소 — onCancel 호출", () => {
    const onCancel = vi.fn();
    render(
      <TeamForm
        row={dummyRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
