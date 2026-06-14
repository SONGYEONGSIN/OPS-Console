import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

const { mockSave, mockEditor } = vi.hoisted(() => ({
  mockSave: vi.fn(),
  mockEditor: { document: [{ id: "b1", type: "paragraph" }] },
}));

vi.mock("@/features/meetings/actions", () => ({
  saveMeetingContent: mockSave,
}));

// BlockNote는 brower-only(ESM contentEditable) — jsdom에서 실제 렌더 불가하므로
// 훅/뷰를 가벼운 stub으로 대체하고 onChange 콜백 호출만 검증한다.
vi.mock("@blocknote/react", () => ({
  useCreateBlockNote: () => mockEditor,
}));
vi.mock("@blocknote/mantine", () => ({
  BlockNoteView: ({ onChange }: { onChange: () => void }) => (
    <button type="button" data-testid="bn-fire" onClick={() => onChange()}>
      edit
    </button>
  ),
}));
vi.mock("@blocknote/mantine/style.css", () => ({}));

import { MeetingEditor } from "../MeetingEditor";

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

describe("MeetingEditor", () => {
  it("초기에는 '자동 저장됨' 상태를 표시한다", () => {
    render(<MeetingEditor id="m1" initialContent={[]} />);
    expect(screen.getByText(/자동 저장됨/)).toBeInTheDocument();
  });

  it("편집 시 '저장 중…'을 표시하고 디바운스 후 saveMeetingContent를 호출한다", async () => {
    mockSave.mockResolvedValue({ ok: true });
    render(<MeetingEditor id="m1" initialContent={[]} />);

    fireEvent.click(screen.getByTestId("bn-fire"));
    expect(screen.getByText(/저장 중/)).toBeInTheDocument();
    expect(mockSave).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(mockSave).toHaveBeenCalledWith("m1", mockEditor.document);
  });

  it("저장 실패 시 '저장 실패 — 재시도'를 표시한다", async () => {
    mockSave.mockResolvedValue({ ok: false, error: "boom" });
    render(<MeetingEditor id="m1" initialContent={[]} />);

    fireEvent.click(screen.getByTestId("bn-fire"));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });
    expect(screen.getByText(/저장 실패/)).toBeInTheDocument();
  });

  it("연속 편집은 디바운스로 마지막 1회만 저장한다", async () => {
    mockSave.mockResolvedValue({ ok: true });
    render(<MeetingEditor id="m1" initialContent={[]} />);

    fireEvent.click(screen.getByTestId("bn-fire"));
    act(() => vi.advanceTimersByTime(400));
    fireEvent.click(screen.getByTestId("bn-fire"));
    await act(async () => {
      vi.advanceTimersByTime(800);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
  });
});
