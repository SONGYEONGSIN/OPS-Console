import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ItemManager } from "../ItemManager";
import {
  updateItemAction,
  addItemAction,
  deleteItemAction,
} from "@/features/checklist/actions";
import type { ChecklistItem } from "@/features/checklist/schemas";

vi.mock("@/features/checklist/actions", () => ({
  updateItemAction: vi.fn(),
  addItemAction: vi.fn(),
  deleteItemAction: vi.fn(),
}));

const mockUpdate = vi.mocked(updateItemAction);
const mockAdd = vi.mocked(addItemAction);
const mockDelete = vi.mocked(deleteItemAction);

const roundId = "11111111-1111-1111-1111-111111111111";

function makeItem(overrides: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: "item-1",
    roundId,
    department: "운영부",
    category: "접수",
    title: "원서 접수 확인",
    status: "todo",
    note: "",
    sortOrder: 0,
    attachments: [],
    ...overrides,
  };
}

describe("ItemManager", () => {
  beforeEach(() => {
    mockUpdate.mockReset();
    mockAdd.mockReset();
    mockDelete.mockReset();
    mockUpdate.mockResolvedValue({ ok: true });
    mockAdd.mockResolvedValue({ ok: true, id: "new-item" });
    mockDelete.mockResolvedValue({ ok: true });
  });

  it("부서명 헤딩 + 분야 라벨 + 항목 제목 렌더", () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[makeItem()]}
      />,
    );
    expect(screen.getByRole("heading", { name: "운영" })).toBeInTheDocument();
    expect(screen.getByText("접수")).toBeInTheDocument();
    expect(screen.getByText("원서 접수 확인")).toBeInTheDocument();
  });

  it("현재 상태 칩이 활성(검정 배경) 스타일 적용", () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[makeItem({ status: "done" })]}
      />,
    );
    const doneChip = screen.getByRole("button", { name: "완료" });
    expect(doneChip.className).toContain("bg-ink");
  });

  it("상태칩 클릭 → updateItemAction(itemId, { status }) 호출", async () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[makeItem({ status: "todo" })]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "완료" }));
    await waitFor(() =>
      expect(mockUpdate).toHaveBeenCalledWith("item-1", { status: "done" }),
    );
  });

  it("부서가 작성한 메모 내용이 관리자 화면에 표시된다(parity)", () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[{ ...makeItem(), note: "부서 작성 메모" }]}
      />,
    );
    expect(screen.getByText("부서 작성 메모")).toBeInTheDocument();
  });

  it("항목 추가 클릭 → addItemAction(roundId, department, category) 호출", async () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[makeItem()]}
      />,
    );
    fireEvent.click(screen.getByText("＋ 항목 추가"));
    await waitFor(() =>
      expect(mockAdd).toHaveBeenCalledWith(roundId, "운영부", "접수"),
    );
  });

  it("삭제 클릭 → deleteItemAction(itemId, roundId) 호출", async () => {
    render(
      <ItemManager
        roundId={roundId}
        department="운영부"
        items={[makeItem()]}
      />,
    );
    fireEvent.click(screen.getByText("삭제"));
    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith("item-1", roundId),
    );
  });
});
