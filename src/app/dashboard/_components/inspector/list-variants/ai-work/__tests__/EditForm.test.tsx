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
