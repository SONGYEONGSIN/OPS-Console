import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataRequestTable, isWriteStartPast } from "../Table";
import type { ListRow } from "../../../../patterns/ListPattern";

function row(over: Partial<ListRow> = {}): ListRow {
  return { id: "s1", name: "원서접수", status: "active", owner: "", universityName: "조선대학교", serviceName: "원서접수", operatorName: "송영신", developerName: "김지은", ...over } as ListRow;
}

describe("DataRequestTable", () => {
  it("대학명/서비스명/운영/개발 렌더", () => {
    render(<DataRequestTable rows={[row()]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("조선대학교")).toBeInTheDocument();
    expect(screen.getByText("원서접수")).toBeInTheDocument();
    expect(screen.getByText("송영신")).toBeInTheDocument();
  });
  it("빈 목록 안내", () => {
    render(<DataRequestTable rows={[]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText(/담당 서비스가 없습니다/)).toBeInTheDocument();
  });
  it("작성시작 컬럼(연도 제외) 표시", () => {
    render(<DataRequestTable rows={[row({ writeStartAt: "2026-05-11T00:00:00+09:00" })]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("작성시작")).toBeInTheDocument();
    expect(screen.getByText("05-11")).toBeInTheDocument();
  });
  it("작성시작이 지난 행은 클릭해도 onSelect 미호출(음영)", () => {
    const onSelect = vi.fn();
    const past = new Date(Date.now() - 5 * 86400000).toISOString();
    render(<DataRequestTable rows={[row({ id: "p1", universityName: "과거대학교", writeStartAt: past })]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("과거대학교"));
    expect(onSelect).not.toHaveBeenCalled();
  });
  it("발송일자 컬럼 헤더 표시", () => {
    render(<DataRequestTable rows={[row()]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("발송일자")).toBeInTheDocument();
  });
  it("발송이력 있으면 일자+시간(KST) 표시", () => {
    // 2026-05-23T05:30:00Z = KST 14:30
    render(<DataRequestTable rows={[row({ writeStartAt: "2026-05-11T00:00:00+09:00", dataRequestLastSentAt: "2026-05-23T05:30:00Z" })]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("05-23 14:30")).toBeInTheDocument();
  });
  it("발송이력 없으면 발송일자 칸에 — 표시 (상태 칸도 —)", () => {
    render(<DataRequestTable rows={[row({ writeStartAt: "2026-05-11T00:00:00+09:00" })]} selectedId={null} onSelect={() => {}} />);
    // 상태 칸(이력 없음) + 발송일자 칸 모두 — → 2개
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
  it("상태 컬럼 헤더 표시 + 예약됨 배지", () => {
    render(<DataRequestTable rows={[row({ writeStartAt: "2026-05-11T00:00:00+09:00", dataRequestStatus: "scheduled" })]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("상태")).toBeInTheDocument();
    expect(screen.getByText("예약됨")).toBeInTheDocument();
  });
  it("발송됨 상태면 발송됨 배지", () => {
    render(<DataRequestTable rows={[row({ writeStartAt: "2026-05-11T00:00:00+09:00", dataRequestStatus: "sent" })]} selectedId={null} onSelect={() => {}} />);
    expect(screen.getByText("발송됨")).toBeInTheDocument();
  });
  it("작성시작이 안 지난 행은 클릭하면 onSelect 호출", () => {
    const onSelect = vi.fn();
    // 40일 뒤면 now 이후 → 전체 날짜 비교로 연도 경계와 무관하게 안전
    const future = new Date(Date.now() + 40 * 86400000).toISOString();
    render(<DataRequestTable rows={[row({ id: "f1", universityName: "미래대학교", writeStartAt: future })]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("미래대학교"));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("isWriteStartPast (전체 날짜 비교)", () => {
  const now = new Date("2026-05-22T12:00:00+09:00");
  it("now 이전이면 true", () => {
    expect(isWriteStartPast("2026-05-11T00:00:00+09:00", now)).toBe(true);
  });
  it("now 이후면 false", () => {
    expect(isWriteStartPast("2026-09-01T00:00:00+09:00", now)).toBe(false);
  });
  it("다음 해(2027 시즌)는 future", () => {
    expect(isWriteStartPast("2027-02-28T00:00:00+09:00", now)).toBe(false);
  });
  it("null/undefined면 false", () => {
    expect(isWriteStartPast(null, now)).toBe(false);
    expect(isWriteStartPast(undefined, now)).toBe(false);
  });
});
