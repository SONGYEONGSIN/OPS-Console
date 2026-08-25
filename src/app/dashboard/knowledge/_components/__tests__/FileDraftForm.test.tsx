import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PollOutcome } from "@/features/assistant/poll-request";

const { draftSpy, pollSpy, fetchSpy, result, poll } = vi.hoisted(() => ({
  draftSpy: vi.fn(),
  pollSpy: vi.fn(),
  fetchSpy: vi.fn(),
  result: { value: { ok: true, id: "req-1", question: "Q본문" } as unknown },
  poll: {
    /** 폴러가 알려주는 진행 단계 — 화면이 지어내지 않는다. */
    stages: ["지식망 문서를 읽는 중 — file.pdf"] as string[],
    outcome: { kind: "done", answer: "**두 가지**만 정해 주세요", sources: [] } as PollOutcome,
    /** true 면 끝나지 않는다 — '도는 중' 화면을 붙잡아 보려고. */
    hold: false,
  },
}));

vi.mock("@/features/knowledge/file-draft-actions", () => ({
  requestFileDraft: (...a: unknown[]) => {
    draftSpy(...a);
    return Promise.resolve(result.value);
  },
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
    return Promise.resolve({ json: () => Promise.resolve({ ok: true, id: "req-2" }) });
  }),
);

const { FileDraftForm } = await import("../FileDraftForm");

const LINK = "https://tenant.sharepoint.com/sites/운영부/보고서.docx";

/**
 * 파일 탐색 화면을 따로 두지 않고 링크를 붙여넣게 한다 — 채널 파일·채팅 파일·
 * 내 OneDrive 가 각각 다른 곳에 있어 어느 하나를 고르는 화면으로는 나머지를 못 넣는다.
 */
describe("FileDraftForm", () => {
  beforeEach(() => {
    draftSpy.mockClear();
    pollSpy.mockClear();
    fetchSpy.mockClear();
    result.value = { ok: true, id: "req-1", question: "Q본문" };
    poll.stages = ["지식망 문서를 읽는 중 — file.pdf"];
    poll.outcome = { kind: "done", answer: "**두 가지**만 정해 주세요", sources: [] };
    poll.hold = false;
  });

  const typeLink = (v: string) =>
    fireEvent.change(screen.getByLabelText("파일 링크"), {
      target: { value: v },
    });

  const submit = () =>
    fireEvent.click(screen.getByRole("button", { name: "초안 요청" }));

  it("링크가 비면 못 누른다 — 빈 요청이 큐에 쌓이지 않게", () => {
    render(<FileDraftForm />);
    expect(screen.getByRole("button", { name: "초안 요청" })).toBeDisabled();
  });

  it("링크와 요청 내용을 함께 보낸다", async () => {
    render(<FileDraftForm />);
    typeLink(LINK);
    fireEvent.change(screen.getByLabelText(/무엇을 정리할지/), {
      target: { value: "수수료 규칙만" },
    });
    submit();
    await waitFor(() =>
      expect(draftSpy).toHaveBeenCalledWith(LINK, "수수료 규칙만"),
    );
  });

  it("지금 무엇을 하는 중인지 보여준다 — 30초를 아무 말 없이 두면 죽은 줄 안다", async () => {
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

  it("답이 오면 그 자리에 보여준다 — 되물어도 아무도 못 보면 초안이 안 생긴다", async () => {
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

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, { body: string }];
    expect(url).toBe("/api/assistant/claude");
    const body = JSON.parse(init.body);
    expect(body.question).toBe("1안, 규칙으로");
    expect(body.history).toEqual([
      { role: "user", content: "Q본문" },
      { role: "assistant", content: "**두 가지**만 정해 주세요" },
    ]);
  });

  it("답이 오기 전에는 답하기 칸이 없다 — 보낼 곳이 없다", async () => {
    poll.outcome = { kind: "timeout" };
    render(<FileDraftForm />);
    typeLink(LINK);
    submit();
    await waitFor(() => expect(screen.getByText(/3분/)).toBeInTheDocument());
    expect(screen.queryByLabelText("답하기")).not.toBeInTheDocument();
  });

  it("에이전트가 실패하면 사유를 보여준다", async () => {
    poll.outcome = { kind: "failed", message: "exit 1" };
    render(<FileDraftForm />);
    typeLink(LINK);
    submit();
    await waitFor(() => expect(screen.getByText(/exit 1/)).toBeInTheDocument());
  });

  it("성공하면 링크 칸을 비운다 — 같은 파일을 두 번 넣기 쉽다", async () => {
    render(<FileDraftForm />);
    typeLink(LINK);
    submit();
    await waitFor(() =>
      expect(screen.getByLabelText("파일 링크")).toHaveValue(""),
    );
  });

  it("적재부터 실패하면 사유를 그대로 보여준다 — 링크가 왜 안 되는지가 조치다", async () => {
    result.value = { ok: false, error: "사내 SharePoint 링크만 받습니다" };
    render(<FileDraftForm />);
    typeLink("https://evil.example.com/a.docx");
    submit();
    await waitFor(() =>
      expect(screen.getByText(/사내 SharePoint 링크만/)).toBeInTheDocument(),
    );
    expect(pollSpy).not.toHaveBeenCalled();
  });

  it("적재부터 실패하면 링크를 지우지 않는다 — 고쳐서 다시 눌러야 한다", async () => {
    result.value = { ok: false, error: "안 됩니다" };
    render(<FileDraftForm />);
    typeLink(LINK);
    submit();
    await waitFor(() => expect(screen.getByText("안 됩니다")).toBeInTheDocument());
    expect(screen.getByLabelText("파일 링크")).toHaveValue(LINK);
  });

  it("제안/ 을 거친다고 미리 알린다 — 바로 볼트에 들어가는 줄 알면 안 된다", () => {
    render(<FileDraftForm />);
    expect(screen.getByText(/본\s*위치로 옮기는 것은 사람이/)).toBeInTheDocument();
  });
});
