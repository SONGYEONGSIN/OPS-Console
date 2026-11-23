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
const saveItemOverride = vi.fn();
const saveProjectEntry = vi.fn();
const uploadWeeklyImage = vi.fn();
vi.mock("@/features/ops-weekly/actions", () => ({
  saveAreaNote: (...a: unknown[]) => saveAreaNote(...a),
  saveItemOverride: (...a: unknown[]) => saveItemOverride(...a),
  saveProjectEntry: (...a: unknown[]) => saveProjectEntry(...a),
  uploadWeeklyImage: (...a: unknown[]) => uploadWeeklyImage(...a),
}));

import { AreaNotes } from "../_components/AreaNotes";
import { OverrideControls } from "../_components/OverrideControls";
import { ProjectTab } from "../_components/ProjectTab";
import { PendingSavesProvider } from "../_components/pending-saves";
import { SubmitBar } from "../_components/SubmitBar";

function Screen({
  notes = true,
  area = "application",
  timeoutMs,
}: {
  notes?: boolean;
  area?: "application" | "pims";
  timeoutMs?: number;
}) {
  return (
    <PendingSavesProvider timeoutMs={timeoutMs}>
      <SubmitBar reportId="r1" canSubmit />
      {notes ? (
        <AreaNotes
          key={area}
          reportId="r1"
          area={area}
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
  saveItemOverride.mockReset().mockResolvedValue({ ok: true });
  saveProjectEntry.mockReset().mockResolvedValue({ ok: true });
  uploadWeeklyImage.mockReset();
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
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "제출완료" })).toBeEnabled(),
    );
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

  const blockedWith = (text: string) =>
    screen.queryAllByRole("alert").some((a) => a.textContent?.includes(text));

  it("실패한 편집기가 화면에서 사라져도(탭 이동) 제출을 계속 막고 어디서 실패했는지 말한다", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    const { rerender } = render(<Screen />);
    typeThenBlur("금주 내용");
    await screen.findByText("저장 안 됨");
    rerender(<Screen notes={false} />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() =>
      expect(blockedWith("원서접수 영역 특이사항")).toBe(true),
    );
    expect(submitReport).not.toHaveBeenCalled();
  });

  it("합격자 발표 특이사항 저장이 실패하면 그 이름으로 막는다", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    render(<Screen area="pims" />);
    typeThenBlur("x");
    await screen.findByText("저장 안 됨");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() =>
      expect(blockedWith("합격자 발표 영역 특이사항")).toBe(true),
    );
    expect(blockedWith("PIMS 영역 특이사항")).toBe(false);
  });

  it("언마운트된 뒤에 끝난 실패도 기록되고, 다시 마운트해 저장에 성공하면 풀린다", async () => {
    const d = deferred<{ ok: false; error: string }>();
    saveAreaNote.mockReturnValueOnce(d.promise).mockResolvedValue({ ok: true });
    const { rerender } = render(<Screen />);
    typeThenBlur("x");
    rerender(<Screen notes={false} />);
    await act(async () => {
      d.resolve({ ok: false, error: "네트워크" });
    });
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(blockedWith("제출하지 않았습니다")).toBe(true));
    expect(submitReport).not.toHaveBeenCalled();
    rerender(<Screen />);
    typeThenBlur("y");
    await screen.findByText(/^저장됨/);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });

  it("다른 영역의 성공 저장은 실패를 지우지 않는다", async () => {
    saveAreaNote
      .mockResolvedValueOnce({ ok: false, error: "저장 실패" })
      .mockResolvedValue({ ok: true });
    const { rerender } = render(<Screen />);
    typeThenBlur("a");
    await screen.findByText("저장 안 됨");
    rerender(<Screen area="pims" />);
    typeThenBlur("b");
    await screen.findByText(/^저장됨/);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() =>
      expect(blockedWith("원서접수 영역 특이사항")).toBe(true),
    );
    expect(submitReport).not.toHaveBeenCalled();
  });

  it("건 메모 실패 뒤 같은 행의 [빼기] 성공이 실패를 지우지 않는다", async () => {
    saveItemOverride
      .mockResolvedValueOnce({ ok: false, error: "실패" })
      .mockResolvedValue({ ok: true });
    render(
      <PendingSavesProvider>
        <SubmitBar reportId="r1" canSubmit />
        <OverrideControls
          reportId="r1"
          itemKey="k"
          area="application"
          note=""
          excluded={false}
          editable
        >
          <span>대학</span>
        </OverrideControls>
      </PendingSavesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "메모" }));
    const input = screen.getByLabelText("건 메모");
    fireEvent.change(input, { target: { value: "메모1" } });
    fireEvent.blur(input);
    await screen.findByText("실패");
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "빼기" })).toBeEnabled(),
    );
    fireEvent.click(screen.getByRole("button", { name: "빼기" }));
    await waitFor(() => expect(saveItemOverride).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(blockedWith("제출하지 않았습니다")).toBe(true));
    expect(submitReport).not.toHaveBeenCalled();
  });

  describe("이미지 붙여넣기 업로드", () => {
    const entry = {
      projectId: "p",
      projectName: "통합원서",
      kind: "project" as const,
      sortOrder: 1,
      operatorEmail: "a@example.com",
      operatorName: "운영자A",
      stage: null,
      thisWeek: "",
      nextWeek: "",
    };
    function mountProject() {
      render(
        <PendingSavesProvider>
          <SubmitBar reportId="r1" canSubmit />
          <ProjectTab
            kind="project"
            entries={[entry]}
            reportId="r1"
            editable
            notes={{ thisWeek: "", nextWeek: "" }}
          />
        </PendingSavesProvider>,
      );
    }
    function pasteImage() {
      const file = new File(["x"], "a.png", { type: "image/png" });
      fireEvent.paste(screen.getAllByRole("textbox")[0], {
        clipboardData: {
          items: [{ type: "image/png", getAsFile: () => file }],
        },
      });
    }

    it("업로드가 끝나고 저장까지 나간 뒤에 제출한다", async () => {
      const d = deferred<{ ok: true; url: string }>();
      uploadWeeklyImage.mockReturnValue(d.promise);
      mountProject();
      pasteImage();
      await waitFor(() => expect(uploadWeeklyImage).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(submitReport).not.toHaveBeenCalled();
      await act(async () => {
        d.resolve({ ok: true, url: "https://signed/x" });
      });
      await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
      expect(saveProjectEntry).toHaveBeenCalled();
      expect(saveProjectEntry.mock.invocationCallOrder[0]).toBeLessThan(
        submitReport.mock.invocationCallOrder[0],
      );
    });

    it("업로드가 실패해도 기다린 뒤 제출을 막지 않는다(저장 안 된 내용이 없다)", async () => {
      const d = deferred<{ ok: false; error: string }>();
      uploadWeeklyImage.mockReturnValue(d.promise);
      mountProject();
      pasteImage();
      await waitFor(() => expect(uploadWeeklyImage).toHaveBeenCalled());
      fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
      await act(async () => {
        await new Promise((r) => setTimeout(r, 20));
      });
      expect(submitReport).not.toHaveBeenCalled();
      await act(async () => {
        d.resolve({ ok: false, error: "너무 큼" });
      });
      await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
      expect(blockedWith("제출하지 않았습니다")).toBe(false);
    });
  });

  it("실패한 뒤 글을 서버 값으로 되돌려도 실패가 남아 제출을 막지 않는다", async () => {
    saveAreaNote.mockResolvedValue({ ok: false, error: "저장 실패" });
    render(<Screen />);
    typeThenBlur("임시");
    await screen.findByText("저장 안 됨");
    saveAreaNote.mockResolvedValue({ ok: true });
    typeThenBlur("");
    await screen.findByText(/^저장됨/);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });

  it("실패한 건 메모를 서버 값으로 되돌려도 제출을 막지 않는다", async () => {
    saveItemOverride
      .mockResolvedValueOnce({ ok: false, error: "실패" })
      .mockResolvedValue({ ok: true });
    render(
      <PendingSavesProvider>
        <SubmitBar reportId="r1" canSubmit />
        <OverrideControls
          reportId="r1"
          itemKey="k"
          area="application"
          note=""
          excluded={false}
          editable
        >
          <span>대학</span>
        </OverrideControls>
      </PendingSavesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "메모" }));
    fireEvent.change(screen.getByLabelText("건 메모"), {
      target: { value: "메모1" },
    });
    fireEvent.blur(screen.getByLabelText("건 메모"));
    await screen.findByText("실패");
    fireEvent.click(screen.getByRole("button", { name: "메모 고치기" }));
    fireEvent.change(screen.getByLabelText("건 메모"), {
      target: { value: "" },
    });
    fireEvent.blur(screen.getByLabelText("건 메모"));
    await waitFor(() => expect(saveItemOverride).toHaveBeenCalledTimes(2));
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });

  it("저장을 기다리는 동안 이유를 보여 준다", async () => {
    const d = deferred<{ ok: true }>();
    saveAreaNote.mockReturnValue(d.promise);
    render(<Screen />);
    typeThenBlur("x");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    expect(
      await screen.findByText("저장 중인 항목을 기다리는 중…"),
    ).toBeInTheDocument();
    await act(async () => {
      d.resolve({ ok: true });
    });
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("저장 중인 항목을 기다리는 중…")).toBeNull();
  });

  it("저장이 끝나지 않으면 제한 시간 뒤 제출하지 않고 안내한다", async () => {
    const d = deferred<{ ok: true }>();
    saveAreaNote.mockReturnValue(d.promise);
    render(<Screen timeoutMs={30} />);
    typeThenBlur("x");
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(blockedWith("저장이 끝나지 않아")).toBe(true));
    expect(submitReport).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "제출완료" })).toBeEnabled(),
    );
    await act(async () => {
      d.resolve({ ok: true });
    });
  });

  it("제공자 밖에서는 기존처럼 바로 제출한다", async () => {
    render(<SubmitBar reportId="r1" canSubmit />);
    fireEvent.click(screen.getByRole("button", { name: "제출완료" }));
    await waitFor(() => expect(submitReport).toHaveBeenCalledTimes(1));
  });
});
