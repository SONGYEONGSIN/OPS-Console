import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  within,
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

const tokens = (el: Element) => el.className.split(/\s+/);

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
    fireEvent.click(screen.getByRole("button", { name: "메모" }));
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

  it("묶음은 상자가 아니라 제목 밑줄 + 행 구분선이다", () => {
    const { container } = render(
      <AutoGroupSection {...group([view("closing:1")])} editable />,
    );
    expect(tokens(container.querySelector("section") as Element)).not.toContain(
      "border",
    );
    const head = screen.getByRole("heading", { name: "운영 중" })
      .parentElement as Element;
    expect(tokens(head)).toContain("border-b");
    expect(tokens(head)).toContain("border-line");
    const ul = container.querySelector("ul") as Element;
    expect(tokens(ul)).toContain("divide-y");
    expect(tokens(ul)).toContain("divide-line-soft");
  });

  it("빈 묶음은 상자 없이 muted 한 줄이고 목록이 없다", () => {
    const { container } = render(
      <AutoGroupSection {...group([])} editable={false} />,
    );
    const t = tokens(screen.getByText("없음"));
    expect(t).toContain("text-sm");
    expect(t).toContain("text-muted");
    expect(container.querySelector("ul")).toBeNull();
  });

  it("제목 옆에 자동+직접 건수가 숫자 정렬로 붙는다", () => {
    const manual = [
      {
        id: "m1",
        area: "application" as const,
        group_key: "running",
        title: "수동",
        note: "",
        period_start: null,
        period_end: null,
        leave_kind: null,
      },
    ];
    render(
      <AutoGroupSection
        {...group([view("closing:1")])}
        manual={manual}
        editable
      />,
    );
    expect(tokens(screen.getByText("2건"))).toContain("tabular-nums");
  });

  it("머리 건수는 뺀 건을 세지 않는다 — 하위 탭·KPI 숫자와 같은 식(뺀 행은 목록에 남는다)", () => {
    render(
      <AutoGroupSection
        {...group([
          view("closing:1"),
          view("closing:2", { excluded: true }),
          view("closing:3"),
        ])}
        editable
      />,
    );
    expect(screen.getByText("2건")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("접힌 묶음(구분 미확인)은 닫힌 채이다", () => {
    const { container } = render(
      <AutoGroupSection
        {...group([view("closing:1")])}
        title="구분 미확인 1건"
        collapsed
        editable
      />,
    );
    expect(container.querySelector("details")).not.toHaveAttribute("open");
  });

  it("행 호버 면과 액션이 키보드로 닿는다 — 액션은 같은 li 안", () => {
    render(<AutoGroupSection {...group([view("closing:1")])} editable />);
    const li = screen.getByText("가대학교").closest("li") as Element;
    expect(tokens(li)).toContain("group");
    expect(tokens(li)).toContain("hover:bg-line-soft");
    expect(li.contains(screen.getByRole("button", { name: "빼기" }))).toBe(
      true,
    );
  });
});

describe("AutoGroupSection — 표 모양(원서접수)", () => {
  const T = { atLabel: "오픈" };
  const manualRow = {
    id: "m1",
    area: "application" as const,
    group_key: "running",
    title: "수동 서비스",
    note: "",
    period_start: null,
    period_end: null,
    leave_kind: null,
  };

  it("머리 칸 — 대학명·대학구분·카테고리·서비스명·일시(묶음별 이름)·메모", () => {
    render(
      <AutoGroupSection
        {...group([view("closing:1", { universityType: "2년제", category: "편입" })])}
        editable
        table={T}
      />,
    );
    const table = screen.getByRole("table", { name: "운영 중" });
    expect(
      [...table.querySelectorAll("th")].map((h) => h.textContent),
    ).toEqual(["대학명", "대학구분", "카테고리", "서비스명", "오픈", "메모"]);
    const row = screen.getAllByRole("row")[1];
    const cells = [...row.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells.slice(0, 4)).toEqual(["가대학교", "2년제", "편입", "수시모집"]);
  });

  it("값이 없으면 — (예전에 굳힌 스냅샷)", () => {
    render(<AutoGroupSection {...group([view("closing:1")])} editable table={T} />);
    const row = screen.getAllByRole("row")[1];
    const cells = [...row.querySelectorAll("td")].map((c) => c.textContent);
    expect(cells[1]).toBe("—");
    expect(cells[2]).toBe("—");
  });

  it("[빼기] 가 행 안에 있고 뺀 행은 취소선", async () => {
    const { rerender } = render(
      <AutoGroupSection {...group([view("closing:1")])} editable table={T} />,
    );
    const row = screen.getAllByRole("row")[1];
    fireEvent.click(within(row).getByRole("button", { name: "빼기" }));
    await waitFor(() =>
      expect(saveItemOverride).toHaveBeenCalledWith({
        reportId: "r",
        itemKey: "closing:1",
        area: "application",
        excluded: true,
      }),
    );
    rerender(
      <AutoGroupSection
        {...group([view("closing:1", { excluded: true })])}
        editable
        table={T}
      />,
    );
    expect(tokens(screen.getAllByRole("row")[1])).toContain("line-through");
  });

  it("직접 추가 건도 표의 한 행 — 배지와 [삭제]", async () => {
    render(
      <AutoGroupSection {...group([])} manual={[manualRow]} editable table={T} />,
    );
    const row = screen.getByText("수동 서비스").closest("tr") as HTMLElement;
    expect(row).toHaveTextContent("직접 추가");
    fireEvent.click(within(row).getByRole("button", { name: "삭제" }));
    await waitFor(() =>
      expect(removeManualItem).toHaveBeenCalledWith({ reportId: "r", itemId: "m1" }),
    );
  });

  it("비면 표 없이 emptyText", () => {
    render(<AutoGroupSection {...group([])} editable table={T} />);
    expect(screen.queryByRole("table")).toBeNull();
    expect(screen.getByText("없음")).toBeInTheDocument();
  });
});
