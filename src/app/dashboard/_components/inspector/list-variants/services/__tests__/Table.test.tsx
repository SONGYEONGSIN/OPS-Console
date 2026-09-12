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
  it("헤더 7컬럼 — 대학명/서비스명/카테고리/운영자/작성마감/남은일수/단독", () => {
    render(
      <ServicesTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("대학명")).toBeInTheDocument();
    expect(screen.getByText("서비스명")).toBeInTheDocument();
    expect(screen.getByText("카테고리")).toBeInTheDocument();
    expect(screen.getByText("운영자")).toBeInTheDocument();
    expect(screen.getByText("작성마감")).toBeInTheDocument();
    expect(screen.getByText("남은일수")).toBeInTheDocument();
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

  it("듀얼 표기 — solo=false 행은 '듀얼', '단독'은 헤더 1건뿐", () => {
    render(
      <ServicesTable
        rows={[{ ...baseRow, solo: false }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("듀얼")).toBeInTheDocument();
    expect(screen.getAllByText("단독").length).toBe(1);
  });

  /**
   * 둘 다 배지고, 무게는 색이 진다.
   *
   * 처음엔 `단독` 만 배지였다 — 그때는 그게 예외라 혼자 눈에 띄어야 했다.
   * 2026-09-12 인제스트가 굳어 있던 `solo` 를 풀면서 전제가 뒤집혔다:
   * 전체 933건 중 단독이 776건(83%)이고, 마감 전 241건은 단독 120 대 듀얼 121 이다.
   * 83% 에 붙은 주황은 강조가 아니라 배경이고, 반반인 두 값을 한쪽만 배지로 두면
   * 형태가 빈도를 거짓말한다. 구분값의 조용한 톤은 `BADGE_TONE.idle` 이고,
   * 인스펙터의 접수구분이 이미 같은 모양을 쓴다.
   */
  it("듀얼도 배지다 — 단독과 같은 형태, 톤만 다르다", () => {
    render(
      <ServicesTable
        rows={[{ ...baseRow, solo: false }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const el = screen.getByText("듀얼");
    expect(el.className).toContain("inline-block");
    expect(el.className).toContain("px-2");
    expect(el.className).toContain("text-xs");
    expect(el.className).toContain("bg-line-soft");
    expect(el.className).toContain("text-muted");
    expect(el.className).not.toContain("bg-vermilion");
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
