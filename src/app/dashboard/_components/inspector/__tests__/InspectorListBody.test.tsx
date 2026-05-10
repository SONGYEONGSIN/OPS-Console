import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InspectorListBody } from "../InspectorListBody";
import type { ListRow } from "../../patterns/ListPattern";

const fixture: ListRow = {
  id: "svc-pay-001",
  name: "결제 게이트웨이",
  status: "urgent",
  owner: "박현주",
};

describe("InspectorListBody", () => {
  it("read 모드 — 데이터 read-only 표시", () => {
    render(
      <InspectorListBody row={fixture} editing={false} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByText("svc-pay-001")).toBeInTheDocument();
    expect(screen.getByText("박현주")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("edit 모드 — input 노출", () => {
    render(
      <InspectorListBody row={fixture} editing={true} onSave={vi.fn()} onCancel={vi.fn()} />
    );
    expect(screen.getByLabelText("이름")).toHaveValue("결제 게이트웨이");
    expect(screen.getByLabelText("담당")).toHaveValue("박현주");
  });

  it("저장 — onSave(next) 호출, next에 변경 반영", () => {
    const onSave = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={vi.fn()} />
    );
    fireEvent.change(screen.getByLabelText("이름"), {
      target: { value: "결제 GW v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith({ ...fixture, name: "결제 GW v2" });
  });

  it("취소 — onCancel 호출, onSave 호출 X", () => {
    const onSave = vi.fn();
    const onCancel = vi.fn();
    render(
      <InspectorListBody row={fixture} editing={true} onSave={onSave} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByRole("button", { name: /취소/ }));
    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe("InspectorListBody team variant — 권한 select", () => {
  const teamRow: ListRow = {
    id: "annooy@jinhakapply.com",
    name: "정윤나",
    status: "active",
    owner: "운영1팀",
    meta: "매니저",
    permission: "member",
  };

  it("admin이 편집 모드 + team variant → 권한 select 노출", () => {
    render(
      <InspectorListBody
        row={teamRow}
        editing={true}
        variant="team"
        currentUserPermission="admin"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("권한")).toBeInTheDocument();
  });

  it("member가 편집 모드 + team variant → 권한 select hide", () => {
    render(
      <InspectorListBody
        row={teamRow}
        editing={true}
        variant="team"
        currentUserPermission="member"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("권한")).not.toBeInTheDocument();
  });

  it("view mode + team variant + row.permission='admin' → '관리자' 노출", () => {
    render(
      <InspectorListBody
        row={{ ...teamRow, permission: "admin" }}
        editing={false}
        variant="team"
        currentUserPermission="admin"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });
});

describe("InspectorListBody team variant — 메뉴 권한 체크박스", () => {
  const teamRow: ListRow = {
    id: "annooy@jinhakapply.com",
    name: "정윤나",
    status: "active",
    owner: "운영1팀",
    meta: "매니저",
    permission: "member",
    allowedMenus: ["alerts", "feedback"],
  };

  it("admin이 편집 모드 → 메뉴 체크박스 그룹 노출 + 일부 체크 상태", () => {
    render(
      <InspectorListBody
        row={teamRow}
        editing={true}
        variant="team"
        currentUserPermission="admin"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const fieldset = screen.getByRole("group", { name: /메뉴 권한/ });
    expect(fieldset).toBeInTheDocument();
    // alerts 체크박스 — 체크 상태
    const alertsBox = screen.getByRole("checkbox", { name: /alerts/i });
    expect(alertsBox).toBeChecked();
    // team 체크박스 — 미체크 (allowedMenus에 없음)
    const teamBox = screen.getByRole("checkbox", { name: /team/i });
    expect(teamBox).not.toBeChecked();
  });

  it("member가 편집 모드 → 체크박스 그룹 hide", () => {
    render(
      <InspectorListBody
        row={teamRow}
        editing={true}
        variant="team"
        currentUserPermission="member"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(
      screen.queryByRole("group", { name: /메뉴 권한/ }),
    ).not.toBeInTheDocument();
  });

  it("admin이 alerts 체크 해제 후 저장 → onSave에 alerts 빠진 allowedMenus", () => {
    const onSave = vi.fn();
    render(
      <InspectorListBody
        row={teamRow}
        editing={true}
        variant="team"
        currentUserPermission="admin"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("checkbox", { name: /alerts/i }));
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        allowedMenus: expect.not.arrayContaining(["alerts"]),
      }),
    );
    expect(onSave.mock.calls[0][0].allowedMenus).toContain("feedback");
  });
});

describe("InspectorListBody post-feedback variant — 등록자 dropdown", () => {
  const feedbackRow: ListRow = {
    id: "fb-1",
    slug: "FB-001",
    name: "개선 요청 1",
    status: "active",
    owner: "",
    author: "송영신",
    body: "내용",
  };

  it("post-feedback editing — 등록자가 select(combobox)로 노출", () => {
    render(
      <InspectorListBody
        row={feedbackRow}
        editing={true}
        variant="post-feedback"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const author = screen.getByLabelText("등록자");
    expect(author.tagName).toBe("SELECT");
  });

  it("post-feedback editing — 매니저 role 운영자도 옵션에 포함 (notice와 차별화)", () => {
    render(
      <InspectorListBody
        row={feedbackRow}
        editing={true}
        variant="post-feedback"
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    // 박시현 = 운영2팀 매니저 — feedback에서는 옵션에 있어야 함
    expect(
      screen.getByRole("option", { name: /박시현/ }),
    ).toBeInTheDocument();
  });

  it("post-feedback editing — 선택 변경 → onSave에 author 반영", () => {
    const onSave = vi.fn();
    render(
      <InspectorListBody
        row={feedbackRow}
        editing={true}
        variant="post-feedback"
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("등록자"), {
      target: { value: "박시현" },
    });
    fireEvent.click(screen.getByRole("button", { name: /저장/ }));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ author: "박시현" }),
    );
  });
});
