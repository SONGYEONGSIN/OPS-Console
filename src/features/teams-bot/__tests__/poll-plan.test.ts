import { describe, it, expect } from "vitest";
import { pickNewMessages, nextCursor } from "../poll-plan";

/**
 * 방에서 읽은 메시지 중 **처리할 것만** 고르고, 다음에 어디서부터 볼지 정한다.
 *
 * 커서를 잘못 옮기면 두 가지 사고가 난다 — 뒤로 가면 같은 질문에 또 답하고,
 * 앞으로 가면 그 사이 질문이 통째로 사라진다. 그래서 순수 함수로 떼어 시험한다.
 */
const at = (s: string) => `2026-08-27T${s}:00Z`;
const msg = (id: string, time: string, text: string) => ({
  id,
  createdDateTime: at(time),
  from: { user: { id: "aad-1" } },
  body: { contentType: "html", content: `<p>${text}</p>` },
});

describe("pickNewMessages", () => {
  const rows = [
    msg("3", "01:03", "명보야 셋"),
    msg("2", "01:02", "그냥 잡담"),
    msg("1", "01:01", "명보야 하나"),
  ];

  it("커서 이후에 온 부름만 고른다", () => {
    const picked = pickNewMessages(rows, at("01:01"));
    expect(picked.map((p) => p.messageId)).toEqual(["3"]);
  });

  it("오래된 것부터 처리한다 — 물어본 순서대로 답해야 한다", () => {
    const picked = pickNewMessages(rows, at("01:00"));
    expect(picked.map((p) => p.messageId)).toEqual(["1", "3"]);
  });

  it("커서가 없으면 아무것도 처리하지 않는다 — 옛 대화에 뒤늦게 답하지 않는다", () => {
    expect(pickNewMessages(rows, null)).toEqual([]);
  });

  it("부름이 아닌 말은 거른다", () => {
    const picked = pickNewMessages(rows, at("01:00"));
    expect(picked.some((p) => p.question.includes("잡담"))).toBe(false);
  });
});

describe("nextCursor", () => {
  const rows = [msg("3", "01:03", "x"), msg("1", "01:01", "y")];

  it("본 것 중 가장 나중 시각으로 옮긴다 — 부름이 아니어도 본 것은 본 것이다", () => {
    expect(nextCursor(rows, at("01:00"))).toBe(at("01:03"));
  });

  it("아무것도 없으면 그대로 둔다", () => {
    expect(nextCursor([], at("01:00"))).toBe(at("01:00"));
  });

  it("뒤로 가지 않는다 — 커서가 되돌아가면 같은 질문에 또 답한다", () => {
    expect(nextCursor(rows, at("02:00"))).toBe(at("02:00"));
  });

  it("시각이 깨진 메시지는 커서를 흔들지 못한다", () => {
    const broken = [{ id: "9", createdDateTime: "이상한값" }];
    expect(nextCursor(broken, at("01:00"))).toBe(at("01:00"));
  });
});
