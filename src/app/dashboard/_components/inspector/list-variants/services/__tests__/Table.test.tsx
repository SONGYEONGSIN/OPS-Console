import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ServicesTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "2026 수시",
  status: "active",
  owner: "박운영",
  serviceIdNum: 1234567,
  universityName: "○○대학교",
  serviceName: "2026 수시 원서접수",
  category: "수시",
  operatorEmail: "op1@example.com",
  operatorName: "박운영",
  writeEndAt: "2026-09-15T00:00:00Z",
  solo: false,
  source: "google_sheet_import",
};

describe("ServicesTable", () => {
  it("헤더 6컬럼 — 대학명/서비스명/카테고리/운영자/작성마감/단독", () => {
    render(
      <ServicesTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("대학명")).toBeInTheDocument();
    expect(screen.getByText("서비스명")).toBeInTheDocument();
    expect(screen.getByText("카테고리")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("작성마감")).toBeInTheDocument();
    expect(screen.getByText("단독")).toBeInTheDocument();
  });

  it("빈 rows — 데이터 없음 안내", () => {
    render(<ServicesTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("기본 행 렌더 — 대학·서비스·카테고리·운영자", () => {
    render(
      <ServicesTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("○○대학교")).toBeInTheDocument();
    expect(screen.getByText("2026 수시 원서접수")).toBeInTheDocument();
    expect(screen.getByText("수시")).toBeInTheDocument();
    expect(screen.getByText("박운영")).toBeInTheDocument();
  });

  it("단독 배지 — solo=true 행에 '단독' span 표시 (header 외 1건 추가 → 총 2건)", () => {
    render(
      <ServicesTable
        rows={[{ ...baseRow, solo: true }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    // 단독여부 컬럼 header + row span 2개
    expect(screen.getAllByText("단독").length).toBe(2);
  });

  it("마감여부 — 작성마감 지난 행은 '마감' 배지, 진행 중인 행은 'D-N'", () => {
    render(
      <ServicesTable
        rows={[
          {
            ...baseRow,
            id: "22222222-2222-2222-2222-222222222222",
            writeEndAt: "2020-01-01T00:00:00Z",
          }, // 지난 것 → 마감
          {
            ...baseRow,
            id: "33333333-3333-3333-3333-333333333333",
            writeEndAt: "2030-01-01T00:00:00Z",
          }, // 미래 → 진행중(D-N)
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("마감")).toBeInTheDocument();
    expect(screen.getByText(/^D-\d+$/)).toBeInTheDocument();
  });

  it("row 클릭 — onSelect(row) 호출", () => {
    const onSelect = vi.fn();
    render(
      <ServicesTable rows={[baseRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("○○대학교"));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });
});
