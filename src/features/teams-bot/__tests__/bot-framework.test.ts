import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Bot Framework 로 메시지를 올리고 고쳐 쓴다.
 *
 * 두 번 쓰는 이유: Teams 는 15초 안에 응답을 기대하는데 우리 답은 6~40초다.
 * 먼저 "찾아보는 중"을 올려 두고, 답이 준비되면 **그 메시지를 고쳐 쓴다.**
 * 새 메시지를 또 붙이면 여럿이 보는 채팅방에서 봇이 두 줄씩 쌓아 대화를 민다.
 */
const f = vi.fn();
const conv = { serviceUrl: "https://smba.trafficmanager.net/kr/", conversationId: "19:x" };

/** 토큰 캐시가 모듈에 살아 있어 테스트끼리 샌다 — 매번 새로 읽는다. */
async function fresh() {
  vi.resetModules();
  return import("@/lib/microsoft/bot-framework");
}

beforeEach(() => {
  f.mockReset();
  vi.stubGlobal("fetch", f);
  vi.stubEnv("TEAMS_BOT_APP_ID", "app-id");
  vi.stubEnv("TEAMS_BOT_APP_PASSWORD", "secret");
});

/** 토큰 발급 → 실제 호출 순으로 답한다. */
function stub(second: { ok: boolean; status: number; body?: unknown }) {
  f.mockReturnValueOnce(
    Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ access_token: "tk", expires_in: 3600 }) }),
  ).mockReturnValueOnce(
    Promise.resolve({ ok: second.ok, status: second.status, json: () => Promise.resolve(second.body ?? {}) }),
  );
}

describe("postActivity", () => {
  it("메시지를 올리고 activity id 를 돌려준다 — 나중에 고쳐 쓸 자리다", async () => {
    const { postActivity } = await fresh();
    stub({ ok: true, status: 201, body: { id: "act-1" } });
    expect(await postActivity({ ...conv, text: "찾아보는 중…" })).toBe("act-1");
  });

  it("실패하면 null — 던지지 않는다. 채팅 한 건이 라우트를 500 으로 만들면 안 된다", async () => {
    const { postActivity } = await fresh();
    stub({ ok: false, status: 403 });
    expect(await postActivity({ ...conv, text: "x" })).toBeNull();
  });

  it("자격증명이 없으면 조용히 null — 배포 전에도 라우트가 죽지 않는다", async () => {
    vi.stubEnv("TEAMS_BOT_APP_ID", "");
    const { postActivity } = await fresh();
    expect(await postActivity({ ...conv, text: "x" })).toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("serviceUrl 뒤에 경로를 이어 붙인다 — 슬래시가 겹치지 않는다", async () => {
    const { postActivity } = await fresh();
    stub({ ok: true, status: 201, body: { id: "a" } });
    await postActivity({ ...conv, text: "x" });
    expect(String(f.mock.calls[1][0])).toBe(
      "https://smba.trafficmanager.net/kr/v3/conversations/19%3Ax/activities",
    );
  });
});

describe("updateActivity", () => {
  it("올려둔 메시지를 고쳐 쓴다", async () => {
    const { updateActivity } = await fresh();
    stub({ ok: true, status: 200 });
    expect(await updateActivity({ ...conv, activityId: "act-1", text: "답" })).toBe(true);
    expect(String(f.mock.calls[1][1]?.method)).toBe("PUT");
  });

  it("고쳐 쓰기가 막히면 false — 호출부가 새 메시지로 물러설 수 있게", async () => {
    const { updateActivity } = await fresh();
    stub({ ok: false, status: 404 });
    expect(await updateActivity({ ...conv, activityId: "act-1", text: "답" })).toBe(false);
  });
});
