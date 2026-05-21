import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AssignmentsView } from "../View";

const makeRow = (overrides: Partial<ListRow> = {}): ListRow => ({
  id: "bbbbbbbb-2222-4222-8222-bbbbbbbbbbbb",
  name: "한양대학교",
  status: "active",
  owner: "",
  assignment: {
    byService: {
      원서접수: {
        operator: "홍길동",
        developer: "이순신",
        detail: [
          { label: "2027 수시 운영", value: "담당" },
          { label: "2027 정시 운영", value: "보조" },
        ],
      },
      PIMS: {
        operator: "강감찬",
        developer: "",
        detail: [],
      },
    },
  },
  ...overrides,
});

describe("AssignmentsView", () => {
  it("대학명(h2) 렌더", () => {
    render(<AssignmentsView row={makeRow()} />);
    const heading = screen.getByRole("heading", { level: 2 });
    expect(heading).toHaveTextContent("한양대학교");
  });

  it("서비스 섹션 — 운영자 노출", () => {
    render(<AssignmentsView row={makeRow()} />);
    // 원서접수 섹션의 "운영 홍길동" 표시
    expect(screen.getByText(/운영 홍길동/)).toBeInTheDocument();
  });

  it("개발자 있을 때 — '· 개발 {dev}' 포함", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.getByText(/· 개발 이순신/)).toBeInTheDocument();
  });

  it("개발자 없을 때(PIMS) — '· 개발 ...' 미노출", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.queryByText(/개발 강감찬/)).toBeNull();
  });

  it("detail 항목 있을 때 — label과 value 렌더", () => {
    render(<AssignmentsView row={makeRow()} />);
    expect(screen.getByText("2027 수시 운영")).toBeInTheDocument();
    expect(screen.getByText("담당")).toBeInTheDocument();
    expect(screen.getByText("2027 정시 운영")).toBeInTheDocument();
    expect(screen.getByText("보조")).toBeInTheDocument();
  });

  it("byService에 없는 서비스 섹션 — 렌더하지 않음", () => {
    render(<AssignmentsView row={makeRow()} />);
    // 대학원, 성적산출, 상담앱은 byService에 없으므로 h3가 2개만 존재
    const serviceHeadings = screen.getAllByRole("heading", { level: 3 });
    const serviceNames = serviceHeadings.map((h) => h.textContent);
    expect(serviceNames).toContain("원서접수");
    expect(serviceNames).toContain("PIMS");
    expect(serviceNames).not.toContain("대학원");
    expect(serviceNames).not.toContain("성적산출");
    expect(serviceNames).not.toContain("상담앱");
  });
});
