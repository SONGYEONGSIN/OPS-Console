import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ServicesForm } from "../EditForm";

const baseRow: ListRow = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "2026 수시",
  status: "active",
  owner: "박운영",
  serviceIdNum: 1234567,
  applicationType: "공통원서",
  region: "서울",
  universityName: "○○대학교",
  serviceName: "2026 수시",
  universityType: "4년제",
  category: "수시",
  operatorEmail: null,
  operatorName: null,
  developerEmail: null,
  developerName: null,
  writeStartAt: null,
  writeEndAt: null,
  payStartAt: null,
  payEndAt: null,
  solo: false,
  source: "folio_create",
  importedAt: null,
};

describe("ServicesForm", () => {
  it("필수 입력 — service_id / 대학명 / 서비스명 / 접수구분 / 지역 / 대학구분 / 카테고리", () => {
    render(
      <ServicesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("service_id")).toBeInTheDocument();
    expect(screen.getByLabelText("대학명")).toHaveValue("○○대학교");
    expect(screen.getByLabelText("서비스명")).toHaveValue("2026 수시");
    expect(screen.getByLabelText("접수구분")).toHaveValue("공통원서");
    expect(screen.getByLabelText("지역")).toHaveValue("서울");
    expect(screen.getByLabelText("대학구분")).toHaveValue("4년제");
    expect(screen.getByLabelText("카테고리")).toHaveValue("수시");
  });

  it("solo 체크박스 — 토글", () => {
    const setRow = vi.fn();
    render(
      <ServicesForm
        row={baseRow}
        setRow={setRow}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByLabelText("단독여부"));
    expect(setRow).toHaveBeenCalled();
  });

  it("저장 — onSave(row) 호출", () => {
    const onSave = vi.fn();
    render(
      <ServicesForm
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
      <ServicesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "취소" }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("삭제 — 기존 row(id != '')일 때만 노출, onSave({...row, status: deleted})", () => {
    const onSave = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(
      <ServicesForm
        row={baseRow}
        setRow={vi.fn()}
        onSave={onSave}
        onCancel={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(onSave).toHaveBeenCalledWith({ ...baseRow, status: "deleted" });
  });

  it("대학명 dropdown — 빈 query 시 미노출 (입력 시에만 검색)", () => {
    const newRow: ListRow = { ...baseRow, id: "", universityName: "" };
    const keys = [
      { universityName: "경찰대학", key: 1111, nextSeq: 5 },
      { universityName: "경찰대학 대학원", key: 1112, nextSeq: 1 },
    ];
    render(
      <ServicesForm
        row={newRow}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        servicesUniversityKeys={keys}
      />,
    );
    expect(screen.queryByLabelText("대학명 검색 결과")).toBeNull();
  });

  it("대학명 dropdown — 입력 시 정확 일치 entry도 노출 (자기 자신 제외 X)", () => {
    const setRow = vi.fn();
    const newRow: ListRow = { ...baseRow, id: "", universityName: "" };
    const keys = [
      { universityName: "경찰대학", key: 1111, nextSeq: 5 },
      { universityName: "경찰대학 대학원", key: 1112, nextSeq: 1 },
      { universityName: "경찰공무원", key: 9999, nextSeq: 1 },
    ];
    render(
      <ServicesForm
        row={newRow}
        setRow={setRow}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        servicesUniversityKeys={keys}
      />,
    );
    // "경찰대학" 입력 → dropdown 노출
    fireEvent.change(screen.getByLabelText("대학명"), {
      target: { value: "경찰대학" },
    });
    expect(screen.getByText("경찰대학")).toBeInTheDocument();
    expect(screen.getByText("경찰대학 대학원")).toBeInTheDocument();
  });

  it("대학명 dropdown — 입력 → 항목 선택 시 자동 close (justSelected)", () => {
    const setRow = vi.fn();
    const newRow: ListRow = { ...baseRow, id: "", universityName: "" };
    const keys = [
      { universityName: "조선대학교", key: 1234, nextSeq: 1 },
      { universityName: "가천대학교", key: 5678, nextSeq: 1 },
    ];
    const { rerender } = render(
      <ServicesForm
        row={newRow}
        setRow={setRow}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        servicesUniversityKeys={keys}
      />,
    );
    // "조선" 입력 → dropdown 노출
    fireEvent.change(screen.getByLabelText("대학명"), {
      target: { value: "조선" },
    });
    expect(screen.getByLabelText("대학명 검색 결과")).toBeInTheDocument();
    // 조선대학교 항목 클릭 → setRow 호출 후 row.universityName 갱신된 상태로 rerender
    fireEvent.click(screen.getByText("조선대학교"));
    expect(setRow).toHaveBeenCalledWith(
      expect.objectContaining({ universityName: "조선대학교" }),
    );
    rerender(
      <ServicesForm
        row={{ ...newRow, universityName: "조선대학교" }}
        setRow={setRow}
        onSave={vi.fn()}
        onCancel={vi.fn()}
        servicesUniversityKeys={keys}
      />,
    );
    // dropdown은 사라져야 함 — universityQuery는 선택한 이름으로 채워졌고 filter에서 자기 자신 제외 → 가천대학교 1건만 남는다? → "조선대학교" includes 매칭만 적용 → 가천 제외
    // 정확 일치 검색 → 자기 자신 제외 → 결과 0 → dropdown close
    expect(screen.queryByLabelText("대학명 검색 결과")).toBeNull();
  });

  it("신규 row (id='') — 삭제 버튼 미노출", () => {
    render(
      <ServicesForm
        row={{ ...baseRow, id: "" }}
        setRow={vi.fn()}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "삭제" })).toBeNull();
  });
});
