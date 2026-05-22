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
  it("작성시작이 안 지난 행은 클릭하면 onSelect 호출", () => {
    const onSelect = vi.fn();
    // 40일 뒤면 같은 해 6월 이후 → 월일 비교 안전 (5월 22일 기준)
    const future = new Date(Date.now() + 40 * 86400000).toISOString();
    render(<DataRequestTable rows={[row({ id: "f1", universityName: "미래대학교", writeStartAt: future })]} selectedId={null} onSelect={onSelect} />);
    fireEvent.click(screen.getByText("미래대학교"));
    expect(onSelect).toHaveBeenCalled();
  });
});

describe("isWriteStartPast", () => {
  const now = new Date("2026-05-22T12:00:00+09:00");
  it("작성시작 월일이 오늘보다 이전이면 true", () => {
    expect(isWriteStartPast("2026-05-11T00:00:00+09:00", now)).toBe(true);
  });
  it("작성시작 월일이 오늘 이후면 false", () => {
    expect(isWriteStartPast("2026-09-01T00:00:00+09:00", now)).toBe(false);
  });
  it("연도 무시 — 다른 연도라도 월일만 비교", () => {
    expect(isWriteStartPast("2025-05-11T00:00:00+09:00", now)).toBe(true);
    expect(isWriteStartPast("2099-09-01T00:00:00+09:00", now)).toBe(false);
  });
  it("null/없으면 false", () => {
    expect(isWriteStartPast(null, now)).toBe(false);
    expect(isWriteStartPast(undefined, now)).toBe(false);
  });
});
