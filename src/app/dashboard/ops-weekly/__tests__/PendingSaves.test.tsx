import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  cleanup,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
}));
const submitReport = vi.fn();
vi.mock("@/features/ops-weekly/workflow-actions", () => ({
  submitReport: (...a: unknown[]) => submitReport(...a),
}));
const saveAreaNote = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveAreaNote: (...a: unknown[]) => saveAreaNote(...a),
  markTabChecked: vi.fn(),
}));

import { AreaNotes } from "../_components/AreaNotes";
import { PendingSavesProvider } from "../_components/pending-saves";
import { WeekHeader } from "../_components/WeekHeader";
import { weekRefFromStart } from "@/features/ops-weekly/week";
import type { WeekRow } from "@/features/ops-weekly/schemas";

const WEEK: WeekRow = {
  id: "w1",
  week_start: "2026-11-16",
  label_year: 2026,
  label_month: 11,
  label_week: 3,
  duty_email: null,
  summary_this: "",
  summary_next: "",
  status: "open",
  reported_at: null,
  reported_by: null,
  reopened_at: null,
  reopened_by: null,
};
const weekRef = weekRefFromStart("2026-11-16");
if (!weekRef) throw new Error("fixture");

const header = {
  weekRef,
  week: WEEK,
  viewedName: "운영자A",
  writers: [{ email: "a@example.com", name: "운영자A" }],
  viewedEmail: "a@example.com",
  submittedCount: 0,
  writerCount: 1,
  dutyName: null,
  canSubmit: true,
  reportStatus: "draft" as const,
  submittedAt: null,
  reportId: "r1",
  prevOpen: false,
  prevHref: "/p",
  nextHref: "/n",
  tab: "application",
};

function Screen({ notes = true }: { notes?: boolean }) {
  return (
    <PendingSavesProvider>
      <WeekHeader {...header} />
      {notes ? (
        <AreaNotes
          reportId="r1"
          area="application"
          thisWeek=""
          nextWeek=""
          editable
        />
      ) : null}
    </PendingSavesProvider>
  );
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function typeThenBlur(value: string) {
  const box = screen.getByLabelText("금주");
  fireEvent.change(box, { target: { value } });
  fireEvent.blur(box);
}

beforeEach(() => {
  refresh.mockReset();
  submitReport.mockReset().mockResolvedValue({ ok: true });
  saveAreaNote.mockReset();
});
afterEach(cleanup);

describe("제출완료 x 자동 저장", () => {
  it("저장이 진행 중이면 끝날 때까지 기다렸다가 제출한다", async () => {
    const d = deferred<{ ok: true }>();
    saveAreaNote.mockReturnValue(d.promise);
    render(<Screen />);
    typeThenBlur("금주 내용");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(submitReport).not.toHaveBeenCalled();
    await act(async () => {
      d.resolve({ ok: true });
    });
    await waitFor(() =>
      expect(submitReport).toHaveBeenCalledWith({ reportId: "r1" }),
    );
  });

  it("기다리던 저장이 실패하면 제출하지 않고 저장 오류를 보여 준다", async () => {
    const d = deferred<{ ok: false; error: string }>();
    saveAreaNote.mockReturnValue(d.promise);
    render(<Screen />);
    typeThenBlur("금주 내용");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await act(async () => {
      d.resolve({ ok: false, error: "저장 실패" });
    });
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((a) => a.textContent?.includes("제출하지 않았습니다")),
      ).toBe(true),
    );
    expect(submitReport).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "제출완료" })).toBeEnabled();
  });

  it("앞서 실패한 저장이 그대로 남아 있어도 제출하지 않는다", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    render(<Screen />);
    typeThenBlur("금주 내용");
    await screen.findByText("저장 안 됨");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() =>
      expect(
        screen
          .getAllByRole("alert")
          .some((a) => a.textContent?.includes("제출하지 않았습니다")),
      ).toBe(true),
    );
    expect(submitReport).not.toHaveBeenCalled();
  });

  it("저장할 것이 없으면 바로 제출한다", async () => {
    render(<Screen />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
    expect(saveAreaNote).not.toHaveBeenCalled();
  });

  it("실패한 편집기가 화면에서 사라지면 더는 제출을 막지 않는다", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    const { rerender } = render(<Screen />);
    typeThenBlur("금주 내용");
    await screen.findByText("저장 안 됨");
    rerender(<Screen notes={false} />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });

  it("제공자 밖에서는 기존처럼 바로 제출한다", async () => {
    render(<WeekHeader {...header} />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });
});
