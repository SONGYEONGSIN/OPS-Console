import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";

const saveItemOverride = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveItemOverride: (...a: unknown[]) => saveItemOverride(...a),
}));

import { OverrideControls } from "../_components/OverrideControls";

const tokens = (el: Element) => el.className.split(/\s+/);

function mount(over: { note?: string; excluded?: boolean } = {}) {
  render(
    <OverrideControls
      reportId="r"
      itemKey="k"
      area="application"
      note={over.note ?? ""}
      excluded={over.excluded ?? false}
      editable
    >
      <span>제목</span>
    </OverrideControls>,
  );
}

beforeEach(() => {
  saveItemOverride.mockReset().mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("OverrideControls 메모는 상시 입력칸이 아니다", () => {
  it("메모는 글로만 보이고 입력칸은 없다", () => {
    mount({ note: "x" });
    expect(screen.queryByRole("textbox", { name: "건 메모" })).toBeNull();
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  it("버튼 이름은 메모 / 메모 고치기", () => {
    mount();
    expect(screen.getByRole("button", { name: "메모" })).toBeInTheDocument();
    cleanup();
    mount({ note: "x" });
    expect(
      screen.getByRole("button", { name: "메모 고치기" }),
    ).toBeInTheDocument();
  });

  it("[메모 고치기] 를 누르면 포커스된 입력칸, blur 하면 저장하고 글로 돌아간다", async () => {
    mount({ note: "x" });
    fireEvent.click(screen.getByRole("button", { name: "메모 고치기" }));
    const box = screen.getByRole("textbox", { name: "건 메모" });
    expect(box).toHaveFocus();
    fireEvent.change(box, { target: { value: "변경" } });
    fireEvent.blur(box);
    await waitFor(() =>
      expect(saveItemOverride).toHaveBeenCalledWith({
        reportId: "r",
        itemKey: "k",
        area: "application",
        note: "변경",
      }),
    );
    expect(screen.queryByRole("textbox", { name: "건 메모" })).toBeNull();
    expect(screen.getByText("변경")).toBeInTheDocument();
  });

  it("Enter 도 한 번만 저장한다", async () => {
    mount();
    fireEvent.click(screen.getByRole("button", { name: "메모" }));
    const box = screen.getByRole("textbox", { name: "건 메모" });
    fireEvent.change(box, { target: { value: "엔터" } });
    fireEvent.keyDown(box, { key: "Enter" });
    fireEvent.blur(box);
    await waitFor(() => expect(saveItemOverride).toHaveBeenCalledTimes(1));
  });

  it("Esc 는 저장하지 않고 원래 메모로 돌아간다", () => {
    mount({ note: "x" });
    fireEvent.click(screen.getByRole("button", { name: "메모 고치기" }));
    const box = screen.getByRole("textbox", { name: "건 메모" });
    fireEvent.change(box, { target: { value: "버릴 글" } });
    fireEvent.keyDown(box, { key: "Escape" });
    fireEvent.blur(box);
    expect(saveItemOverride).not.toHaveBeenCalled();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("x")).toBeInTheDocument();
  });

  it("행 액션은 lg 이상에서 호버·포커스 때만 드러난다(그 아래는 항상)", () => {
    mount();
    const actions = screen.getByRole("button", { name: "빼기" })
      .parentElement as Element;
    const t = tokens(actions);
    expect(t).toContain("lg:opacity-0");
    expect(t).toContain("lg:group-hover:opacity-100");
    expect(t).toContain("lg:group-focus-within:opacity-100");
    expect(t).not.toContain("opacity-0");
    expect(actions.contains(screen.getByRole("button", { name: "메모" }))).toBe(
      true,
    );
  });

  it("뺀 행은 [되살리기] 를 늘 보인다", () => {
    mount({ excluded: true });
    const actions = screen.getByRole("button", { name: "되살리기" })
      .parentElement as Element;
    expect(tokens(actions)).not.toContain("lg:opacity-0");
  });

  it("제목 줄은 뺀 행이면 취소선이고 메모 줄은 그 밖에 있다", () => {
    mount({ excluded: true, note: "메모글" });
    expect(tokens(screen.getByText("제목").parentElement as Element)).toContain(
      "line-through",
    );
    expect(screen.getByText("메모글").className).not.toContain("line-through");
  });
});
