import { describe, it, expect } from "vitest";
import { allowedChats } from "../chat-allow";

/**
 * 어느 방에서 명보를 부를 수 있나.
 *
 * 처음에는 **한 방에서만** 연다(2026-08-27). 전 채팅방에 한꺼번에 풀면 실수로
 * 반응했을 때 여러 방이 한꺼번에 어지러워진다.
 *
 * **빈 값이면 전체가 아니라 아무 데도 아니다.** 설정을 빠뜨렸을 때 전 채팅방이
 * 열리면 그게 가장 나쁜 사고다 — 안 여는 쪽이 안전하다.
 */
const chats = [
  { id: "19:aaa@thread.v2", topic: "원서 마법사들" },
  { id: "19:bbb@thread.v2", topic: "다른 방" },
];

describe("allowedChats", () => {
  it("허용 목록에 있는 방만 남긴다", () => {
    expect(allowedChats(chats, "19:aaa@thread.v2").map((c) => c.id)).toEqual([
      "19:aaa@thread.v2",
    ]);
  });

  it("쉼표로 여러 방을 받는다", () => {
    expect(allowedChats(chats, "19:aaa@thread.v2, 19:bbb@thread.v2")).toHaveLength(2);
  });

  it("빈 값이면 아무 방도 열지 않는다 — 설정 누락이 전면 개방이 되면 안 된다", () => {
    expect(allowedChats(chats, "")).toEqual([]);
    expect(allowedChats(chats, undefined)).toEqual([]);
  });

  it("공백만 있어도 열지 않는다", () => {
    expect(allowedChats(chats, "  ,  ")).toEqual([]);
  });

  it("모르는 id 는 그냥 무시한다 — 지워진 방 때문에 전체가 멈추지 않는다", () => {
    expect(allowedChats(chats, "19:없음,19:aaa@thread.v2")).toHaveLength(1);
  });
});
