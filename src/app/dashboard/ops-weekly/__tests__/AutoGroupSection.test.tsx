import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";

const saveItemOverride = vi.fn();
const removeManualItem = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: (...a: unknown[]) => saveItemOverride(...a),
  removeManualItem: (...a: unknown[]) => removeManualItem(...a),
  addManualItem: vi.fn(),
  saveAreaNote: vi.fn(),
  markTabChecked: vi.fn(),
}));

import { AutoGroupSection } from "../_components/AutoGroupSection";
import { item } from "./tab-fixtures";
import type { ViewItem } from "@/features/ops-weekly/merge";

const view = (key: string, over: Partial<ViewItem> = {}): ViewItem => ({
  ...item(key),
  note: "",
  excluded: false,
  ...over,
});
const group = (items: ViewItem[]) => ({
  title: "운영 중",
  items,
  manual: [],
  reportId: "r",
  area: "application" as const,
  groupKey: "running",
  emptyText: "없음",
});

beforeEach(() => {
  cleanup();
  saveItemOverride.mockReset().mockResolvedValue({ ok: true });
  removeManualItem.mockReset().mockResolvedValue({ ok: true });
});

describe("AutoGroupSection", () => {
  it("[빼기] 는 그 건만 그 주 보고서에서 뺀다", async () => {
    render(<AutoGroupSection {...group([view("closing:1")])} editable />);
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    await waitFor(() =>
      expect(saveItemOverride).toHaveBeenCalledWith({
        reportId: "r",
        itemKey: "closing:1",
        area: "application",
        excluded: true,
      }),
    );
  });

  it("뺀 건은 취소선 + [되살리기]", () => {
    render(
      <AutoGroupSection
        {...group([view("closing:1", { excluded: true })])}
        editable
      />,
    );
    expect(
      screen.getByRole("button", { name: "되살리기" }),
    ).toBeInTheDocument();
    expect(screen.getByText("가대학교").parentElement).toHaveClass(
      "line-through",
    );
  });

  it("메모는 blur 할 때 저장한다", async () => {
    render(<AutoGroupSection {...group([view("closing:1")])} editable />);
    const box = screen.getByLabelText("건 메모");
    fireEvent.change(box, { target: { value: "일정 변경" } });
    fireEvent.blur(box);
    await waitFor(() =>
      expect(saveItemOverride).toHaveBeenCalledWith({
        reportId: "r",
        itemKey: "closing:1",
        area: "application",
        note: "일정 변경",
      }),
    );
  });

  it("저장 실패 문구를 행 아래에 보여 준다", async () => {
    saveItemOverride.mockResolvedValue({ ok: false, error: "저장 실패" });
    render(<AutoGroupSection {...group([view("closing:1")])} editable />);
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    expect(await screen.findByText("저장 실패")).toBeInTheDocument();
  });

  it("편집 불가면 입력·버튼이 없다", () => {
    render(
      <AutoGroupSection {...group([view("closing:1")])} editable={false} />,
    );
    expect(screen.queryByRole("button", { name: "빼기" })).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("직접 추가 건은 배지와 [삭제]", async () => {
    const manual = [
      {
        id: "m1",
        area: "application" as const,
        group_key: "running",
        title: "수동 서비스",
        note: "",
        period_start: null,
        period_end: null,
        leave_kind: null,
      },
    ];
    render(<AutoGroupSection {...group([])} manual={manual} editable />);
    expect(screen.getByText("수동 서비스").closest("li")).toHaveTextContent(
      "직접 추가",
    );
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    await waitFor(() =>
      expect(removeManualItem).toHaveBeenCalledWith({
        reportId: "r",
        itemId: "m1",
      }),
    );
  });

  it("비면 emptyText", () => {
    render(<AutoGroupSection {...group([])} editable={false} />);
    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
