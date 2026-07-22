import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FillForm } from "../FillForm";
import type { ChecklistItem } from "@/features/checklist/schemas";

const fillUpdateItem = vi.fn(
  async (_token: string, _itemId: string, _patch: unknown) => ({ ok: true }),
);
const fillAddItem = vi.fn(
  async (_token: string, _category: string, _title: string) => ({
    ok: true,
    id: "new",
  }),
);
const fillDeleteItem = vi.fn(async (_token: string, _itemId: string) => ({
  ok: true,
}));
vi.mock("@/features/checklist/fill-actions", () => ({
  fillUpdateItem: (token: string, itemId: string, patch: unknown) =>
    fillUpdateItem(token, itemId, patch),
  fillAddItem: (token: string, category: string, title: string) =>
    fillAddItem(token, category, title),
  fillDeleteItem: (token: string, itemId: string) =>
    fillDeleteItem(token, itemId),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

const items: ChecklistItem[] = [
  { id: "i1", roundId: "R1", department: "개발부", category: "서버/시스템", title: "웹 서버 동작 확인", status: null, note: "", sortOrder: 0 },
];

beforeEach(() => {
  fillUpdateItem.mockClear();
});

describe("FillForm", () => {
  it("회차·부서·항목·분야를 렌더한다", () => {
    render(
      <FillForm token="tok" department="개발부" roundTitle="2027 수시" periodStart="2026-08-01" periodEnd="2026-09-01" items={items} />,
    );
    expect(screen.getByText("2027 수시")).toBeInTheDocument();
    expect(screen.getByText("개발부")).toBeInTheDocument();
    expect(screen.getByText("웹 서버 동작 확인")).toBeInTheDocument();
    expect(screen.getByText("서버/시스템")).toBeInTheDocument();
  });

  it("상태 칩 클릭 시 fillUpdateItem(token, itemId, {status})를 호출한다", () => {
    render(<FillForm token="tok" department="개발부" roundTitle="R" periodStart={null} periodEnd={null} items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    expect(fillUpdateItem).toHaveBeenCalledWith("tok", "i1", { status: "done" });
  });

  it("항목이 없으면 안내 문구를 보여준다", () => {
    render(<FillForm token="tok" department="개발부" roundTitle="R" periodStart={null} periodEnd={null} items={[]} />);
    expect(screen.getByText(/항목이 없습니다/)).toBeInTheDocument();
  });
});
