import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PollOutcome } from "@/features/assistant/poll-request";

const { draftSpy, textSpy, pollSpy, fetchSpy, result, textResult, poll, running } =
  vi.hoisted(() => ({
    draftSpy: vi.fn(),
    textSpy: vi.fn(),
    pollSpy: vi.fn(),
    fetchSpy: vi.fn(),
    result: { value: { ok: true, id: "req-1", question: "Q본문" } as unknown },
    textResult: { value: { ok: true, id: "req-t", question: "T본문" } as unknown },
    poll: {
      stages: ["지식망 문서를 읽는 중 — file.pdf"] as string[],
      outcome: {
        kind: "done",
        answer: "**두 가지**만 정해 주세요",
        sources: [],
      } as PollOutcome,
      hold: false,
    },
    running: { value: null as { id: string; question: string } | null },
  }));

vi.mock("@/features/knowledge/file-draft-actions", () => ({
  requestFileDraft: (...a: unknown[]) => {
    draftSpy(...a);
    return Promise.resolve(result.value);
  },
  requestTextDraft: (...a: unknown[]) => {
    textSpy(...a);
    return Promise.resolve(textResult.value);
  },
}));

vi.mock("@/features/knowledge/running-draft", () => ({
  getRunningFileDraft: () => Promise.resolve(running.value),
}));

vi.mock("@/features/assistant/poll-request", () => ({
  pollAssistantRequest: (id: string, onStage: (n: string) => void) => {
    pollSpy(id);
    poll.stages.forEach(onStage);
    if (poll.hold) return new Promise<PollOutcome>(() => {});
    return Promise.resolve(poll.outcome);
  },
}));

vi.stubGlobal(
  "fetch",
  vi.fn((...a: unknown[]) => {
    fetchSpy(...a);
    const url = String(a[0]);
    if (url.includes("/api/knowledge/upload")) {
      return Promise.resolve({
        json: () =>
          Promise.resolve({ ok: true, webUrl: "https://sp/올린것.pdf" }),
      });
    }
    return Promise.resolve({
      json: () => Promise.resolve({ ok: true, id: "req-2" }),
    });
  }),
);

const { FileDraftForm } = await import("../FileDraftForm");

const LINK = "https://tenant.sharepoint.com/sites/운영부/보고서.docx";

const typeLink = (v: string) =>
  fireEvent.change(screen.getByLabelText("파일 링크"), { target: { value: v } });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));
const pickTab = (name: string) =>
  fireEvent.click(screen.getByRole("tab", { name }));

describe("FileDraftForm", () => {
  beforeEach(() => {
    draftSpy.mockClear();
    textSpy.mockClear();
    pollSpy.mockClear();
    fetchSpy.mockClear();
    result.value = { ok: true, id: "req-1", question: "Q본문" };
    textResult.value = { ok: true, id: "req-t", question: "T본문" };
    poll.stages = ["지식망 문서를 읽는 중 — file.pdf"];
    poll.outcome = {
      kind: "done",
      answer: "**두 가지**만 정해 주세요",
      sources: [],
    };
    poll.hold = false;
    running.value = null;
  });

  describe("재료를 어디서 받는가", () => {
    it("세 칸을 탭으로 고른다 — 링크만 되던 걸 넓힌다", () => {
      render(<FileDraftForm />);
      expect(screen.getByRole("tab", { name: "파일링크" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "파일 올리기" })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: "직접 입력" })).toBeInTheDocument();
    });

    it("기본은 링크 — 지금까지 쓰던 길이 그대로 열려 있어야 한다", () => {
      render(<FileDraftForm />);
      expect(screen.getByLabelText("파일 링크")).toBeInTheDocument();
      expect(screen.queryByLabelText("정리할 내용")).not.toBeInTheDocument();
    });

    it("직접 입력 칸은 본문을 그대로 보낸다 — 파일을 안 거친다", async () => {
      render(<FileDraftForm />);
      pickTab("직접 입력");
      fireEvent.change(screen.getByLabelText("정리할 내용"), {
        target: { value: "수수료는 매월 10일 정산" },
      });
      submit();
      await waitFor(() =>
        expect(textSpy).toHaveBeenCalledWith("수수료는 매월 10일 정산", ""),
      );
      expect(draftSpy).not.toHaveBeenCalled();
    });

    it("끌어다 놓아도 받는다 — 우편물 영수증과 같은 방식", async () => {
      render(<FileDraftForm />);
      pickTab("파일 올리기");
      const zone = screen.getByTestId("draft-dropzone");
      const file = new File(["x"], "규정집.pdf", { type: "application/pdf" });
      fireEvent.drop(zone, { dataTransfer: { files: [file] } });
      await waitFor(() => expect(screen.getByText(/규정집\.pdf/)).toBeInTheDocument());
      submit();
      await waitFor(() =>
        expect(draftSpy).toHaveBeenCalledWith("https://sp/올린것.pdf", ""),
      );
    });

    it("고른 파일 이름을 보여준다 — 무엇을 올릴 참인지 알아야 한다", async () => {
      render(<FileDraftForm />);
      pickTab("파일 올리기");
      fireEvent.change(screen.getByLabelText("올릴 파일"), {
        target: {
          files: [new File(["x"], "취업규칙.pdf", { type: "application/pdf" })],
        },
      });
      expect(await screen.findByText(/취업규칙\.pdf/)).toBeInTheDocument();
    });

    it("올린 파일은 링크로 바꿔 같은 길로 보낸다 — 읽는 경로를 새로 안 만든다", async () => {
      render(<FileDraftForm />);
      pickTab("파일 올리기");
      const input = screen.getByLabelText("올릴 파일") as HTMLInputElement;
      fireEvent.change(input, {
        target: {
          files: [new File(["x"], "규정집.pdf", { type: "application/pdf" })],
        },
      });
      submit();
      await waitFor(() =>
        expect(draftSpy).toHaveBeenCalledWith("https://sp/올린것.pdf", ""),
      );
      expect(String(fetchSpy.mock.calls[0][0])).toBe("/api/knowledge/upload");
    });

    it("업로드가 막히면 사유를 그대로 보여준다 — 설정 누락이 조용히 묻히면 안 된다", async () => {
      vi.mocked(fetch).mockImplementationOnce((() =>
        Promise.resolve({
          json: () =>
            Promise.resolve({
              ok: false,
              error: "업로드 폴더가 설정되지 않았습니다",
            }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        })) as any);
      render(<FileDraftForm />);
      pickTab("파일 올리기");
      fireEvent.change(screen.getByLabelText("올릴 파일"), {
        target: { files: [new File(["x"], "a.pdf", { type: "application/pdf" })] },
      });
      submit();
      await waitFor(() =>
        expect(screen.getByText(/업로드 폴더가 설정되지/)).toBeInTheDocument(),
      );
      expect(draftSpy).not.toHaveBeenCalled();
    });

    it("고르지 않으면 못 누른다 — 빈 요청이 큐에 쌓이지 않게", () => {
      render(<FileDraftForm />);
      expect(screen.getByRole("button", { name: "초안 요청" })).toBeDisabled();
      pickTab("직접 입력");
      expect(screen.getByRole("button", { name: "초안 요청" })).toBeDisabled();
    });
  });

  describe("답이 돌아오는 자리", () => {
    it("지금 무엇을 하는 중인지 보여준다", async () => {
      poll.hold = true;
      render(<FileDraftForm />);
      typeLink(LINK);
      submit();
      await waitFor(() =>
        expect(
          screen.getByText(/지식망 문서를 읽는 중 — file\.pdf/),
        ).toBeInTheDocument(),
      );
    });

    it("답이 오면 그 자리에 보여준다", async () => {
      render(<FileDraftForm />);
      typeLink(LINK);
      submit();
      await waitFor(() =>
        expect(screen.getByText(/만 정해 주세요/)).toBeInTheDocument(),
      );
    });

    it("답에 이어서 답할 수 있다 — 앞서 물은 것을 history 로 함께 보낸다", async () => {
      render(<FileDraftForm />);
      typeLink(LINK);
      submit();
      await screen.findByLabelText("답하기");
      fireEvent.change(screen.getByLabelText("답하기"), {
        target: { value: "1안, 규칙으로" },
      });
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));

      await waitFor(() =>
        expect(
          fetchSpy.mock.calls.some(
            (c) => String(c[0]) === "/api/assistant/claude",
          ),
        ).toBe(true),
      );
      const call = fetchSpy.mock.calls.find(
        (c) => String(c[0]) === "/api/assistant/claude",
      )!;
      const body = JSON.parse((call[1] as { body: string }).body);
      expect(body.history).toEqual([
        { role: "user", content: "Q본문" },
        { role: "assistant", content: "**두 가지**만 정해 주세요" },
      ]);
    });

    it("에이전트가 실패하면 사유를 보여준다", async () => {
      poll.outcome = { kind: "failed", message: "exit 1" };
      render(<FileDraftForm />);
      typeLink(LINK);
      submit();
      await waitFor(() => expect(screen.getByText(/exit 1/)).toBeInTheDocument());
    });

    it("적재부터 실패하면 사유를 보여주고 링크를 안 지운다", async () => {
      result.value = { ok: false, error: "사내 SharePoint 링크만 받습니다" };
      render(<FileDraftForm />);
      typeLink(LINK);
      submit();
      await waitFor(() =>
        expect(screen.getByText(/사내 SharePoint 링크만/)).toBeInTheDocument(),
      );
      expect(pollSpy).not.toHaveBeenCalled();
      expect(screen.getByLabelText("파일 링크")).toHaveValue(LINK);
    });
  });

  /**
   * 탭이 URL 이라 다른 탭에 다녀오면 이 컴포넌트가 통째로 죽는다. 이어받지 않으면
   * 답이 사라져, 되묻기를 아무도 못 보던 문제가 그대로 재발한다.
   */
  describe("다른 탭에 다녀와도 이어받는다", () => {
    it("아직 도는 요청이 있으면 붙어서 마저 지켜본다", async () => {
      running.value = { id: "req-살아있음", question: "앞서 물은 것" };
      poll.hold = true;
      render(<FileDraftForm />);
      await waitFor(() => expect(pollSpy).toHaveBeenCalledWith("req-살아있음"));
      expect(
        screen.getByText(/지식망 문서를 읽는 중 — file\.pdf/),
      ).toBeInTheDocument();
    });

    it("이어받은 요청의 답에도 앞서 물은 것이 history 로 실린다", async () => {
      running.value = { id: "req-살아있음", question: "앞서 물은 것" };
      render(<FileDraftForm />);
      await screen.findByLabelText("답하기");
      fireEvent.change(screen.getByLabelText("답하기"), {
        target: { value: "1안" },
      });
      fireEvent.click(screen.getByRole("button", { name: "보내기" }));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const call = fetchSpy.mock.calls.find(
        (c) => String(c[0]) === "/api/assistant/claude",
      )!;
      const body = JSON.parse((call[1] as { body: string }).body);
      expect(body.history[0]).toEqual({ role: "user", content: "앞서 물은 것" });
    });

    it("도는 게 없으면 아무것도 안 띄운다", async () => {
      render(<FileDraftForm />);
      await waitFor(() => expect(pollSpy).not.toHaveBeenCalled());
      expect(screen.queryByLabelText("답하기")).not.toBeInTheDocument();
    });
  });

  it("제안/ 을 거친다고 미리 알린다 — 바로 볼트에 들어가는 줄 알면 안 된다", () => {
    render(<FileDraftForm />);
    expect(screen.getByText(/본\s*위치로 옮기는 것은 사람이/)).toBeInTheDocument();
  });
});
