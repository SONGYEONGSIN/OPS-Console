import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ListPattern } from "../ListPattern";
import type { ListRow } from "../ListPattern";

const sampleRows: ListRow[] = [
  { id: "L-001", name: "민원 접수 #1", status: "urgent", owner: "박지연" },
  { id: "L-002", name: "민원 접수 #2", status: "active", owner: "김민수" },
  { id: "L-003", name: "민원 접수 #3", status: "approved", owner: "이수진" },
];

describe("ListPattern", () => {
  it("title heading 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    expect(
      screen.getByRole("heading", { name: "민원 목록", level: 2 }),
    ).toBeInTheDocument();
  });

  it("rows 모두 렌더 + 상태 라벨 한국어", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    expect(screen.getByText("민원 접수 #1")).toBeInTheDocument();
    expect(screen.getByText("민원 접수 #2")).toBeInTheDocument();
    expect(screen.getByText("민원 접수 #3")).toBeInTheDocument();
    expect(screen.getByText("긴급")).toBeInTheDocument();
    expect(screen.getByText("활성")).toBeInTheDocument();
    expect(screen.getByText("정상")).toBeInTheDocument();
  });

  it("빈 데이터 — 데이터 없음 안내", () => {
    render(<ListPattern title="민원 목록" data={{ rows: [] }} />);
    expect(screen.getByText("데이터 없음")).toBeInTheDocument();
  });

  it("초기 상태 — Inspector 닫혀있음 (aria-hidden)", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
  });

  it("행 클릭 → Inspector 열림 + 선택 행 정보 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    const panel = screen.getByRole("complementary");
    expect(panel).toHaveAttribute("aria-hidden", "false");
    // 패널 헤더에 행 이름 노출 (h3)
    expect(
      screen.getByRole("heading", { name: "민원 접수 #1", level: 3 }),
    ).toBeInTheDocument();
  });

  it("행 클릭 → 편집 버튼 노출", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    expect(screen.getByRole("button", { name: /편집/ })).toBeInTheDocument();
  });

  it("편집 → 이름 수정 → 저장 시 rows 갱신 + 패널 닫힘", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    fireEvent.click(screen.getByText("민원 접수 #1"));
    fireEvent.click(screen.getByRole("button", { name: /편집/ }));
    const nameInput = screen.getByLabelText("이름");
    fireEvent.change(nameInput, { target: { value: "민원 갱신됨" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    // 패널 닫힘 (aria-hidden=true)
    const panel = screen.getByRole("complementary", { hidden: true });
    expect(panel).toHaveAttribute("aria-hidden", "true");
    // rows 갱신 — 테이블에 새 이름 노출
    expect(screen.getByText("민원 갱신됨")).toBeInTheDocument();
    expect(screen.queryByText("민원 접수 #1")).not.toBeInTheDocument();
  });

  it("선택된 행 — 시각적으로 강조 (bg-washi-raised)", () => {
    render(<ListPattern title="민원 목록" data={{ rows: sampleRows }} />);
    const row = screen.getByText("민원 접수 #2").closest("tr");
    fireEvent.click(row!);
    expect(row?.className).toContain("bg-washi-raised");
  });
});
