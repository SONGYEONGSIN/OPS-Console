import { describe, it, expect, vi } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsEditForm } from "../EditForm";

const OPS = [
  { email: "a@x.com", name: "가운영" },
  { email: "b@x.com", name: "나운영" },
];

const makeRow = (): ListRow => ({
  id: "서울대학교",
  name: "서울대학교",
  status: "active",
  owner: "",
  assignment: {
    academicYear: 2027,
    byService: {
      PIMS: {
        operator: "",
        developer: "",
        detail: [],
        cells: [
          {
            subtype: "FULL",
            role: "운영",
            name: "가운영",
            email: "a@x.com",
          },
          { subtype: "FULL", role: "개발", name: "가개발", email: null },
        ],
      },
      대학원: {
        operator: "",
        developer: "",
        detail: [],
        cells: [{ subtype: "", role: "운영", name: "미매칭이", email: null }],
      },
    },
  },
});

/**
 * 폼은 **원장의 칸을 그대로** 편집한다. 담당자 교체·비우기만이고, 새 칸은 만들지
 * 않는다 — (업무종류 × 하위유형) 유효 조합 표가 없어서 열면 오타가 아무도 안 보는
 * 칸을 만든다.
 *
 * 운영 칸은 **명부에서 고른다**(이메일이 이력의 단위다). 개발 칸은 자유 입력이다 —
 * `operators` 는 운영부 표라 개발자가 없고, 그래서 개발 칸 편집은 이력에 안 남는다
 * (사용자 결정 2026-09-17).
 */
function Harness({ onSave = vi.fn() }: { onSave?: (r: ListRow) => void }) {
  const [row, setRow] = useState<ListRow>(makeRow());
  return (
    <AssignmentsEditForm
      row={row}
      setRow={setRow}
      onSave={onSave}
      onCancel={vi.fn()}
      assignmentOperators={OPS}
    />
  );
}

const cellsOf = (row: ListRow, kind: string) =>
  row.assignment?.byService[kind]?.cells ?? [];

describe("AssignmentsEditForm", () => {
  it("칸마다 줄이 있다 — 업무종류·하위유형·역할로 찾는다", () => {
    render(<Harness />);
    expect(screen.getByLabelText("PIMS FULL 운영")).toBeInTheDocument();
    expect(screen.getByLabelText("PIMS FULL 개발")).toBeInTheDocument();
    // 하위유형이 없는 업무는 라벨에서 빠진다.
    expect(screen.getByLabelText("대학원 운영")).toBeInTheDocument();
  });

  it("운영 칸은 명부에서 고르는 select 다 — 비움도 고를 수 있다", () => {
    render(<Harness />);
    const select = screen.getByLabelText("PIMS FULL 운영");
    expect(select.tagName).toBe("SELECT");
    const values = [...(select as HTMLSelectElement).options].map(
      (o) => o.value,
    );
    expect(values).toEqual(["", "a@x.com", "b@x.com"]);
  });

  it("개발 칸은 자유 입력이다 — 개발자는 명부에 없다", () => {
    render(<Harness />);
    const input = screen.getByLabelText("PIMS FULL 개발");
    expect(input.tagName).toBe("INPUT");
    expect((input as HTMLInputElement).value).toBe("가개발");
  });

  it("운영자를 고르면 그 칸의 이메일과 이름이 함께 바뀐다", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("PIMS FULL 운영"), {
      target: { value: "b@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const saved = onSave.mock.calls[0][0] as ListRow;
    const cell = cellsOf(saved, "PIMS").find((c) => c.role === "운영");
    expect(cell).toMatchObject({ email: "b@x.com", name: "나운영" });
  });

  it("비움을 고르면 이메일과 이름이 함께 비워진다", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("PIMS FULL 운영"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const saved = onSave.mock.calls[0][0] as ListRow;
    const cell = cellsOf(saved, "PIMS").find((c) => c.role === "운영");
    expect(cell).toMatchObject({ email: null, name: "" });
  });

  it("개발자 이름을 치면 이름만 바뀐다 — 이메일은 계속 없다", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("PIMS FULL 개발"), {
      target: { value: "나개발" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const saved = onSave.mock.calls[0][0] as ListRow;
    const cell = cellsOf(saved, "PIMS").find((c) => c.role === "개발");
    expect(cell).toMatchObject({ email: null, name: "나개발" });
  });

  it("한 칸을 고쳐도 다른 칸은 그대로다", () => {
    const onSave = vi.fn();
    render(<Harness onSave={onSave} />);

    fireEvent.change(screen.getByLabelText("PIMS FULL 운영"), {
      target: { value: "b@x.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    const saved = onSave.mock.calls[0][0] as ListRow;
    expect(cellsOf(saved, "PIMS").find((c) => c.role === "개발")).toMatchObject(
      { name: "가개발" },
    );
    expect(cellsOf(saved, "대학원")[0]).toMatchObject({ name: "미매칭이" });
  });

  /**
   * 이메일을 못 맞춘 운영 칸은 select 가 비움으로 보인다(값이 옵션에 없다). 이름까지
   * 사라지면 **그 칸이 원래 미배정이었는지 미매칭이었는지 구분할 수 없다** — 고칠
   * 사람은 그 이름으로 누구였는지 안다.
   */
  it("이메일이 안 붙은 운영 칸은 이름을 화면에 남긴다", () => {
    render(<Harness />);
    expect(screen.getByText(/미매칭이/)).toBeInTheDocument();
  });

  it("취소를 누르면 onCancel 이 불린다", () => {
    const onCancel = vi.fn();
    render(
      <AssignmentsEditForm
        row={makeRow()}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
        assignmentOperators={OPS}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("칸이 없으면 고칠 것이 없다고 알린다 — 빈 폼은 고장으로 보인다", () => {
    render(
      <AssignmentsEditForm
        row={{
          id: "빈대학",
          name: "빈대학",
          status: "active",
          owner: "",
          assignment: { academicYear: 2027, byService: {} },
        }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        assignmentOperators={OPS}
      />,
    );
    expect(screen.getByText(/고칠 칸이 없습니다/)).toBeInTheDocument();
  });
});
