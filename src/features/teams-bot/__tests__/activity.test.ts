import { describe, it, expect } from "vitest";
import { readActivity } from "../activity";

/**
 * Teams 가 보내온 Activity 에서 **물어본 사람과 물어본 것**만 꺼낸다.
 *
 * 채팅방에서 부르면 본문에 멘션이 통째로 섞여 온다(`<at>명보</at> 질문`).
 * 그대로 큐에 넣으면 에이전트가 제 이름을 질문의 일부로 읽는다.
 *
 * 순수 함수로 두는 이유: 라우트 안에 묻으면 이상한 모양이 왔을 때를 테스트할 수 없다.
 */
const base = {
  type: "message",
  id: "1700000000000",
  serviceUrl: "https://smba.trafficmanager.net/kr/",
  from: { id: "29:abc", name: "송영신", aadObjectId: "aad-1" },
  conversation: { id: "19:chat@thread.v2", conversationType: "groupChat" },
  text: "<at>명보</at> 부산대 인수인계 알려줘",
  entities: [
    { type: "mention", text: "<at>명보</at>", mentioned: { id: "28:bot", name: "명보" } },
  ],
};

describe("readActivity", () => {
  it("멘션을 걷어내고 질문만 남긴다", () => {
    const r = readActivity(base, "28:bot");
    expect(r.ok && r.question).toBe("부산대 인수인계 알려줘");
  });

  it("누가 물었는지 가져온다 — 이메일이 아니라 디렉터리 id다", () => {
    const r = readActivity(base, "28:bot");
    expect(r.ok && r.aadObjectId).toBe("aad-1");
  });

  it("어디로 답할지 가져온다", () => {
    const r = readActivity(base, "28:bot");
    expect(r.ok && r.conversationId).toBe("19:chat@thread.v2");
    expect(r.ok && r.serviceUrl).toBe("https://smba.trafficmanager.net/kr/");
  });

  it("멘션이 중간에 있어도 걷어낸다", () => {
    const r = readActivity(
      { ...base, text: "야 <at>명보</at> 이거 뭐야" },
      "28:bot",
    );
    expect(r.ok && r.question).toBe("야 이거 뭐야");
  });

  it("멘션만 있고 질문이 없으면 거절한다 — 빈 질문을 큐에 넣지 않는다", () => {
    const r = readActivity({ ...base, text: "<at>명보</at>" }, "28:bot");
    expect(r.ok).toBe(false);
  });

  it("나를 안 불렀으면 무시한다 — 채팅방의 모든 말에 답하지 않는다", () => {
    const r = readActivity(
      {
        ...base,
        text: "<at>다른봇</at> 안녕",
        entities: [
          { type: "mention", text: "<at>다른봇</at>", mentioned: { id: "28:other", name: "다른봇" } },
        ],
      },
      "28:bot",
    );
    expect(r.ok).toBe(false);
  });

  it("메시지가 아닌 것은 무시한다 — 들어오고 나가는 알림에 답하지 않는다", () => {
    const r = readActivity({ ...base, type: "conversationUpdate" }, "28:bot");
    expect(r.ok).toBe(false);
  });

  it("보낸 사람 id 가 없으면 거절한다 — 누구인지 모르면 답할 수 없다", () => {
    const r = readActivity(
      { ...base, from: { id: "29:abc", name: "x" } },
      "28:bot",
    );
    expect(r.ok).toBe(false);
  });

  it("모양이 아예 다르면 던지지 않고 거절한다", () => {
    expect(readActivity(null, "28:bot").ok).toBe(false);
    expect(readActivity({ type: "message" }, "28:bot").ok).toBe(false);
  });

  it("질문이 너무 길면 자른다 — 채팅방 붙여넣기가 큐를 막지 않게", () => {
    const r = readActivity(
      { ...base, text: "<at>명보</at> " + "가".repeat(5000) },
      "28:bot",
    );
    expect(r.ok && r.question.length).toBeLessThanOrEqual(4000);
  });
});

/**
 * 실제 Teams 가 보내는 모양 — 2026-08-26 라이브에서 드러났다.
 *
 * 설정을 네 시간 의심했는데 요청은 처음부터 오고 있었다. `POST 200` 이 찍히는 동안
 * **파서가 전부 거절**하고 있었다. 두 가지를 몰랐다:
 *
 * 1. **개인 채팅에는 멘션이 없다** — 1:1 에서 `@명보` 를 쓰지 않는다
 * 2. **멘션 id 에 `28:` 접두사가 붙는다** — App ID 와 직접 비교하면 안 맞는다
 */
describe("readActivity — 실제 Teams 모양", () => {
  const APP_ID = "0024b39d-b624-4dbe-a1bf-4b72b22c94dd";

  it("멘션 id 의 28: 접두사를 넘어 나를 알아본다", () => {
    const r = readActivity(
      {
        ...base,
        text: "<at>명보</at> 질문",
        entities: [
          {
            type: "mention",
            text: "<at>명보</at>",
            mentioned: { id: `28:${APP_ID}`, name: "명보" },
          },
        ],
      },
      APP_ID,
    );
    expect(r.ok && r.question).toBe("질문");
  });

  it("개인 채팅은 멘션 없이 받는다 — 1:1 에서는 부를 이름이 없다", () => {
    const r = readActivity(
      {
        ...base,
        conversation: { id: "19:me", conversationType: "personal" },
        text: "안녕",
        entities: [],
      },
      APP_ID,
    );
    expect(r.ok && r.question).toBe("안녕");
  });

  it("그룹방에서는 여전히 멘션이 있어야 한다 — 모든 말에 답하지 않는다", () => {
    const r = readActivity(
      { ...base, text: "그냥 잡담", entities: [] },
      APP_ID,
    );
    expect(r.ok).toBe(false);
  });

  it("팀 채널도 멘션이 있어야 한다", () => {
    const r = readActivity(
      {
        ...base,
        conversation: { id: "19:ch", conversationType: "channel" },
        text: "잡담",
        entities: [],
      },
      APP_ID,
    );
    expect(r.ok).toBe(false);
  });
});
