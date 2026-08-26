import { describe, it, expect } from "vitest";
import { replyTextFor, TEAMS_TEXT_LIMIT } from "../reply-text";

/**
 * 큐의 한 건을 채팅에 쓸 한 덩이 글로 만든다.
 *
 * 답이 아직 없을 수도, 실패했을 수도, 회사 PC 가 꺼져 있을 수도 있다. **어느 경우든
 * "찾아보는 중…"이 영영 남아 있으면 안 된다** — 그건 사람이 계속 기다리게 만든다.
 */
const done = { status: "done", answer: "부산대는 …", requested_at: new Date().toISOString() };

describe("replyTextFor", () => {
  it("답이 있으면 답을 쓴다", () => {
    expect(replyTextFor(done)?.startsWith("부산대는")).toBe(true);
  });

  it("아직 도는 중이면 아무것도 하지 않는다 — 고쳐 쓸 것이 없다", () => {
    expect(replyTextFor({ ...done, status: "running", answer: null })).toBeNull();
  });

  it("오래 걸리면 사실대로 알린다 — 회사 PC 가 꺼져 있을 수 있다", () => {
    const old = new Date(Date.now() - 5 * 60_000).toISOString();
    const t = replyTextFor({ status: "pending", answer: null, requested_at: old });
    expect(t).toMatch(/응답이 없/);
  });

  it("실패하면 사유를 적는다 — 조용히 지우지 않는다", () => {
    const t = replyTextFor({ status: "failed", answer: null, message: "볼트를 못 읽었습니다", requested_at: done.requested_at });
    expect(t).toMatch(/볼트를 못 읽었습니다/);
  });

  it("실패인데 사유가 없어도 문장이 남는다", () => {
    const t = replyTextFor({ status: "failed", answer: null, requested_at: done.requested_at });
    expect((t ?? "").length).toBeGreaterThan(0);
  });

  it("답이 너무 길면 자르고 잘렸다고 알린다 — 말없이 끊기면 오해한다", () => {
    const t = replyTextFor({ ...done, answer: "가".repeat(TEAMS_TEXT_LIMIT + 500) }) ?? "";
    expect(t.length).toBeLessThanOrEqual(TEAMS_TEXT_LIMIT);
    expect(t).toMatch(/잘렸|웹에서/);
  });

  it("done 인데 답이 비면 그 사실을 적는다 — 빈 메시지로 고쳐 쓰지 않는다", () => {
    const t = replyTextFor({ ...done, answer: "   " });
    expect((t ?? "").length).toBeGreaterThan(0);
  });
});
