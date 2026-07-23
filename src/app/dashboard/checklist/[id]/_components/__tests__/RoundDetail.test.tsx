import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundDetail } from "../RoundDetail";
import type {
  ChecklistRound,
  ChecklistItem,
  ShareToken,
} from "@/features/checklist/schemas";

// ShareLinks/ItemManager 자식이 참조하는 서버 액션 모킹
vi.mock("@/features/checklist/actions", () => ({
  updateItemAction: vi.fn(),
  addItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
  toggleChecklistShare: vi.fn(),
}));

const round: ChecklistRound = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2027학년도 수시모집",
  periodStart: "2027-01-01",
  periodEnd: "2027-01-31",
  status: "active",
  createdBy: "ys1114@x.com",
  createdAt: "2027-01-01T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
};

const items: ChecklistItem[] = [
  {
    id: "i-1",
    roundId: round.id,
    department: "운영부",
    category: "접수",
    title: "원서 접수 확인",
    status: "done",
    note: "",
    sortOrder: 0,
    attachments: [],
  },
  {
    id: "i-2",
    roundId: round.id,
    department: "운영부",
    category: "접수",
    title: "결제 확인",
    status: "in_progress",
    note: "",
    sortOrder: 1,
    attachments: [],
  },
  {
    id: "i-3",
    roundId: round.id,
    department: "개발부",
    category: "시스템",
    title: "서버 점검",
    status: "todo",
    note: "",
    sortOrder: 0,
    attachments: [],
  },
];

const tokens: ShareToken[] = [];

describe("RoundDetail", () => {
  it("회차 제목 + 기간 표시 (생성자 이메일은 미표시)", () => {
    render(<RoundDetail round={round} items={items} tokens={tokens} />);
    expect(screen.getByText("2027학년도 수시모집")).toBeInTheDocument();
    expect(screen.getByText(/2027-01-01.*2027-01-31/)).toBeInTheDocument();
    expect(screen.queryByText(/ys1114@x.com/)).not.toBeInTheDocument();
  });

  it("요약 KPI — 전체 항목 라벨 + 총 개수(computeCompletion 연동)", () => {
    render(<RoundDetail round={round} items={items} tokens={tokens} />);
    expect(screen.getByText("전체 항목")).toBeInTheDocument();
    expect(
      screen.getByText("완료", { selector: "span.text-xs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("진행중", { selector: "span.text-xs" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("작업전", { selector: "span.text-xs" }),
    ).toBeInTheDocument();
    const totalCard = screen.getByText("전체 항목").closest("div");
    expect(totalCard).toHaveTextContent("3");
  });

  it("항목이 있는 부서만 섹션 렌더 — 항목 없는 부서는 미렌더", () => {
    render(<RoundDetail round={round} items={items} tokens={tokens} />);
    expect(screen.getByRole("heading", { name: "운영" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "개발" })).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "기획" }),
    ).not.toBeInTheDocument();
  });

  it("공유 링크 액션 행 — 작성/확인 링크 생성 버튼 렌더", () => {
    render(<RoundDetail round={round} items={items} tokens={tokens} />);
    expect(screen.getByText("작성 공유 링크 생성")).toBeInTheDocument();
    expect(screen.getByText("보고용 링크 생성")).toBeInTheDocument();
  });
});
