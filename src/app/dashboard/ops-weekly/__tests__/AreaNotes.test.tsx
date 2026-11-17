import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
} from "@testing-library/react";

const saveAreaNote = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveAreaNote: (...a: unknown[]) => saveAreaNote(...a),
  markTabChecked: vi.fn(),
}));

import { AreaNotes } from "../_components/AreaNotes";

const tokens = (el: Element) => el.className.split(/\s+/);

function mount() {
  render(
    <AreaNotes
      reportId="r"
      area="application"
      thisWeek=""
      nextWeek=""
      editable
    />,
  );
}
const edit = (value: string) => {
  const box = screen.getByLabelText("금주");
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
};

beforeEach(() => {
  saveAreaNote.mockReset();
});
afterEach(cleanup);

describe("AreaNotes 자동 저장 표시", () => {
  it("처음엔 자동 저장, 저장이 끝나면 24시간제 저장됨 HH:MM", async () => {
    saveAreaNote.mockResolvedValue({ ok: true });
    mount();
    expect(screen.getByText("자동 저장")).toBeInTheDocument();
    edit("내용");
    const saved = await screen.findByText(/^저장됨 \d{2}:\d{2}$/);
    expect(saved.textContent).not.toMatch(/오전|오후/);
    expect(saved.getAttribute("aria-live")).toBe("polite");
  });

  it("저장 중에는 저장 중…", async () => {
    // 끝나지 않는 저장을 남기면 React 의 비동기 전환이 얽혀 다음 테스트가 흔들린다 — 직접 끝낸다.
    let finish!: (v: { ok: true }) => void;
    saveAreaNote.mockReturnValue(
      new Promise((r) => {
        finish = r;
      }),
    );
    mount();
    edit("내용");
    expect(await screen.findByText("저장 중…")).toBeInTheDocument();
    finish({ ok: true });
    expect(await screen.findByText(/^저장됨/)).toBeInTheDocument();
  });

  it("실패하면 vermilion 저장 안 됨 + 필드 아래 상세 문구", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    mount();
    edit("내용");
    const badge = await screen.findByText("저장 안 됨");
    expect(tokens(badge)).toContain("text-vermilion");
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("저장 실패"),
    );
  });

  it("큰 절 구분선과 [이 탭 확인] 설명", () => {
    mount();
    const section = screen
      .getByRole("heading", { name: "영역 특이사항" })
      .closest("section") as Element;
    expect(tokens(section)).toContain("border-line");
    expect(tokens(section)).toContain("pt-6");
    expect(
      screen.getByText("확인하면 탭 옆에 확인 표시가 남습니다"),
    ).toBeInTheDocument();
  });
});
