import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsTable } from "../Table";

const makeRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa",
  name: "가천대학교",
  status: "active",
  owner: "",
  assignment: {
    byService: {
      원서접수: { operator: "홍길동", developer: "이순신", detail: [] },
      PIMS: { operator: "강감찬", developer: "", detail: [] },
    },
  },
  ...overrides,
});

describe("AssignmentsTable", () => {
  it("헤더 — '대학' + 5개 서비스 종류 노출", () => {
    render(
      <AssignmentsTable rows={[makeRow()]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("대학")).toBeInTheDocument();
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("대학원")).toBeInTheDocument();
    expect(screen.getByText("PIMS")).toBeInTheDocument();
    expect(screen.getByText("성적산출")).toBeInTheDocument();
    expect(screen.getByText("상담앱")).toBeInTheDocument();
  });

  it("operator+developer 있는 셀 — '{op} / {dev}' 형식 (접두어 없음)", () => {
    render(
      <AssignmentsTable rows={[makeRow()]} selectedId={null} onSelect={vi.fn()} />,
    );
    // 원서접수: operator=홍길동, developer=이순신
    expect(screen.getByText("홍길동 / 이순신")).toBeInTheDocument();
    // '운'/'개' 접두어는 제거됨
    expect(screen.queryByText(/운 홍길동/)).toBeNull();
  });

  it("operator만 있는 셀(developer 빈 문자열) — 운영자 이름만 표시", () => {
    render(
      <AssignmentsTable rows={[makeRow()]} selectedId={null} onSelect={vi.fn()} />,
    );
    // PIMS: operator=강감찬, developer="" → 이름만, '운' 접두어 없음
    expect(screen.getByText("강감찬")).toBeInTheDocument();
    expect(screen.queryByText(/운 강감찬/)).toBeNull();
  });

  it("배정 없는 서비스 셀 — '—' 표시", () => {
    render(
      <AssignmentsTable rows={[makeRow()]} selectedId={null} onSelect={vi.fn()} />,
    );
    // 대학원, 성적산출, 상담앱은 byService에 없으므로 '—' 3개
    const dashes = screen.getAllByText("—");
    expect(dashes.length).toBeGreaterThanOrEqual(3);
  });

  it("row 클릭 → onSelect(row) 호출", () => {
    const onSelect = vi.fn();
    const row = makeRow();
    render(
      <AssignmentsTable rows={[row]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("가천대학교"));
    expect(onSelect).toHaveBeenCalledWith(row);
  });

  it("대학명(name) 렌더", () => {
    render(
      <AssignmentsTable
        rows={[makeRow({ name: "세종대학교" })]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("세종대학교")).toBeInTheDocument();
  });
});
