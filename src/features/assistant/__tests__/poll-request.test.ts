import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { pollAssistantRequest } from "../poll-request";
import { STAGE_QUEUED, STAGE_STILL_QUEUED } from "../stage-label";

/**
 * 큐 폴링 루프 — 어시스턴트 창과 '파일로 초안'이 같은 것을 쓴다.
 *
 * 두 벌이 되면 27초 claim 사고로 얻은 판단("안 가져갔어도 멈추지 않는다")이
 * 한쪽에만 남는다.
 */
const state = {
  /** 폴링 차례마다 돌려줄 응답. 마지막 것을 계속 돌려준다. */
  replies: [] as Record<string, unknown>[],
  calls: 0,
};

vi.stubGlobal(
  "fetch",
  vi.fn(() => {
    const i = Math.min(state.calls, state.replies.length - 1);
    state.calls += 1;
    return Promise.resolve({
      json: () => Promise.resolve(state.replies[i]),
    });
  }),
);

describe("pollAssistantRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    state.calls = 0;
    state.replies = [{ ok: true, status: "running" }];
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("done 이면 답과 근거를 돌려준다", async () => {
    state.replies = [
      { ok: true, status: "done", answer: "답입니다", sources: ["규칙/a.md"] },
    ];
    const p = pollAssistantRequest("id1", () => {});
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({
      kind: "done",
      answer: "답입니다",
      sources: ["규칙/a.md"],
    });
  });

  it("failed 면 사유를 돌려준다 — 조용히 끝내지 않는다", async () => {
    state.replies = [{ ok: true, status: "failed", message: "exit 1" }];
    const p = pollAssistantRequest("id1", () => {});
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({ kind: "failed", message: "exit 1" });
  });

  it("서버가 준 단계를 그대로 알린다 — 화면이 지어내지 않는다", async () => {
    const notes: string[] = [];
    state.replies = [
      { ok: true, status: "running", stage: "지식망 문서를 읽는 중 — file.pdf" },
      { ok: true, status: "done", answer: "끝" },
    ];
    const p = pollAssistantRequest("id1", (n) => notes.push(n));
    await vi.advanceTimersByTimeAsync(4000);
    await p;
    expect(notes[0]).toBe(STAGE_QUEUED);
    expect(notes).toContain("지식망 문서를 읽는 중 — file.pdf");
  });

  it("오래 안 가져가면 알리되 멈추지 않는다 — 27초 뒤 claim 된 적이 있다", async () => {
    const notes: string[] = [];
    state.replies = [{ ok: true, status: "pending" }];
    const p = pollAssistantRequest("id1", (n) => notes.push(n));
    await vi.advanceTimersByTimeAsync(20_000);
    expect(notes).toContain(STAGE_STILL_QUEUED);

    // 여기서 끝나면 안 된다 — 늦게 온 답이 통째로 사라진다.
    state.replies = [{ ok: true, status: "done", answer: "늦게 왔다" }];
    state.calls = 0;
    await vi.advanceTimersByTimeAsync(2000);
    await expect(p).resolves.toEqual({
      kind: "done",
      answer: "늦게 왔다",
      sources: [],
    });
  });

  it("3분이 지나면 끝낸다", async () => {
    state.replies = [{ ok: true, status: "running" }];
    const p = pollAssistantRequest("id1", () => {});
    // 판정이 폴링 차례에 붙어 있어 3분을 **넘긴** 다음 차례(182초)에 끝난다.
    await vi.advanceTimersByTimeAsync(184_000);
    await expect(p).resolves.toEqual({ kind: "timeout" });
  });
});
