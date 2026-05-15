import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ContactsTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "김지나",
  status: "active",
  owner: "",
  customerActive: "재직",
  jobTitle: "팀장",
  universityName: "가천대학교",
  departmentName: "입학팀",
  jobRole: "실무자",
  managementGrade: "A",
  relationshipGrade: "우호적",
  contactPhone: "010-1234-5678",
  contactExt: "031-750-1234",
  contactEmail: "kjn@gachon.ac.kr",
};

describe("ContactsTable", () => {
  it("8 컬럼 헤더 노출", () => {
    render(
      <ContactsTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("활성화")).toBeInTheDocument();
    expect(screen.getByText("고객명")).toBeInTheDocument();
    expect(screen.getByText("직함")).toBeInTheDocument();
    expect(screen.getByText("대학명")).toBeInTheDocument();
    expect(screen.getByText("소속부서")).toBeInTheDocument();
    expect(screen.getByText("직책")).toBeInTheDocument();
    expect(screen.getByText("관리등급")).toBeInTheDocument();
    expect(screen.getByText("관계등급")).toBeInTheDocument();
  });

  it("빈 rows — '데이터 없음' 안내", () => {
    render(<ContactsTable rows={[]} selectedId={null} onSelect={vi.fn()} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("row 클릭 → onSelect(row) 호출", () => {
    const onSelect = vi.fn();
    render(
      <ContactsTable rows={[baseRow]} selectedId={null} onSelect={onSelect} />,
    );
    fireEvent.click(screen.getByText("김지나"));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });

  it("기본 데이터 렌더 — 고객명/대학명/관리등급", () => {
    render(
      <ContactsTable rows={[baseRow]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("김지나")).toBeInTheDocument();
    expect(screen.getByText("가천대학교")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(screen.getByText("우호적")).toBeInTheDocument();
  });
});
