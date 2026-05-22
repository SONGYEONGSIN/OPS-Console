import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DataRequestTable } from "../Table";
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
});
