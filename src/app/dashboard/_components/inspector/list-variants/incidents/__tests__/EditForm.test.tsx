import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import type { SeverityCriteria } from "@/features/incidents/schemas";
import type { OperatorPermission } from "@/features/operators/schemas";

vi.mock("@/features/incidents/severity-criteria-actions", () => ({
  updateSeverityCriteria: vi.fn(),
}));

import { IncidentEditForm } from "../EditForm";

// 테스트 fixture — 실제 기준 문구의 원천은 마이그레이션 seed 하나다.
const CRITERIA: SeverityCriteria = {
  심각: "기준-심각",
  높음: "기준-높음",
  보통: "기준-보통",
  낮음: "기준-낮음",
};

/** setRow 를 실제 state 로 묶어야 고른 등급이 저장 payload 에 실린다. */
function StatefulForm({
  initial,
  onSave,
  permission = null,
  criteria = CRITERIA,
}: {
  initial: ListRow;
  onSave: (row: ListRow) => void;
  permission?: OperatorPermission | null;
  criteria?: SeverityCriteria | null;
}) {
  const [row, setRow] = useState<ListRow>(initial);
  return (
    <IncidentEditForm
      row={row}
      setRow={setRow}
      onSave={onSave}
      onCancel={vi.fn()}
      currentUserPermission={permission}
      incidentSeverityCriteria={criteria}
    />
  );
}

const NEW_ROW = { id: "", name: "" } as unknown as ListRow;
const EXISTING_ROW = { id: "x", name: "기존" } as unknown as ListRow;

describe("IncidentEditForm", () => {
  it("담당부서 select는 다른 입력창과 같은 기본 음영(bg-field-bg)이다", () => {
    const row = { id: "", name: "" } as unknown as ListRow;
    render(
      <IncidentEditForm
        row={row}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const select = screen.getByLabelText("담당부서");
    expect(select.className).toContain("bg-field-bg");
    expect(select.className).not.toContain("bg-washi");
    expect(select.className).toContain("cursor-not-allowed");
  });
});

describe("IncidentEditForm — 사고 등급", () => {
  it("처리일자 → 사고 등급 → 사고제목 순서다", () => {
    render(<StatefulForm initial={NEW_ROW} onSave={vi.fn()} />);
    const resolved = screen.getByLabelText("처리일자");
    const severity = screen.getByLabelText("사고 등급");
    const title = screen.getByLabelText("사고제목");
    expect(
      resolved.compareDocumentPosition(severity) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      severity.compareDocumentPosition(title) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("새 행에 등급 없이 저장하면 onSave 가 안 불리고 안내가 뜨며, 등급을 고르면 사라진다", () => {
    const onSave = vi.fn();
    render(<StatefulForm initial={NEW_ROW} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("사고 등급을 선택하세요.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("사고 등급"), {
      target: { value: "높음" },
    });
    expect(screen.queryByText("사고 등급을 선택하세요.")).toBeNull();
  });

  it("새 행에 등급을 고르고 저장하면 onSave 가 incidentSeverity 를 담아 불린다", () => {
    const onSave = vi.fn();
    render(<StatefulForm initial={NEW_ROW} onSave={onSave} />);
    fireEvent.change(screen.getByLabelText("사고 등급"), {
      target: { value: "심각" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0][0]).toMatchObject({ incidentSeverity: "심각" });
  });

  it("기존 행은 등급이 없어도 onSave 가 불린다", () => {
    const onSave = vi.fn();
    render(<StatefulForm initial={EXISTING_ROW} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("사고 등급을 선택하세요.")).toBeNull();
  });

  it("admin 에게만 기준 편집 버튼이 보인다", () => {
    const { unmount } = render(
      <StatefulForm initial={NEW_ROW} onSave={vi.fn()} permission="admin" />,
    );
    expect(
      screen.getByRole("button", { name: "사고 등급 기준 편집" }),
    ).toBeTruthy();
    unmount();

    render(
      <StatefulForm initial={NEW_ROW} onSave={vi.fn()} permission="member" />,
    );
    expect(
      screen.queryByRole("button", { name: "사고 등급 기준 편집" }),
    ).toBeNull();
  });

  it("넘겨받은 기준 문구가 툴팁에 보인다", () => {
    render(<StatefulForm initial={NEW_ROW} onSave={vi.fn()} />);
    expect(screen.getByRole("tooltip").textContent).toContain("기준-심각");
  });

  it("신규 행에만 (필수) 가 붙는다", () => {
    const { unmount } = render(
      <StatefulForm initial={NEW_ROW} onSave={vi.fn()} />,
    );
    expect(screen.getByText("(필수)")).toBeTruthy();
    unmount();

    render(<StatefulForm initial={EXISTING_ROW} onSave={vi.fn()} />);
    expect(screen.queryByText("(필수)")).toBeNull();
  });

  it("M2: 가드에 걸리면 등급 select 로 포커스가 가고, 다른 칸에 있다가 다시 눌러도 간다", () => {
    render(<StatefulForm initial={NEW_ROW} onSave={vi.fn()} />);
    const severity = screen.getByLabelText("사고 등급");
    const save = screen.getByRole("button", { name: "저장" });
    fireEvent.click(save);
    expect(document.activeElement).toBe(severity);

    const title = screen.getByLabelText("사고제목");
    title.focus();
    expect(document.activeElement).toBe(title);
    fireEvent.click(save);
    expect(document.activeElement).toBe(severity);
  });
});
