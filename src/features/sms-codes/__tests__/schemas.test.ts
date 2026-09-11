import { describe, it, expect } from "vitest";
import { SMS_CONSUMERS, smsConsumeSchema } from "../schemas";

describe("smsConsumeSchema — 스크래퍼 창구 입력", () => {
  it("등록된 소비자 + reset/pop 만 받는다", () => {
    expect(
      smsConsumeSchema.safeParse({ action: "reset", consumer: "closing" })
        .success,
    ).toBe(true);
    expect(
      smsConsumeSchema.safeParse({ action: "pop", consumer: "ratio-audit" })
        .success,
    ).toBe(true);
  });

  it("consumer 오타는 거절 — 리스가 이름으로 구분되므로 오타 하나가 점유를 무력화한다", () => {
    expect(
      smsConsumeSchema.safeParse({ action: "reset", consumer: "closng" })
        .success,
    ).toBe(false);
  });

  it("모르는 action 은 거절", () => {
    expect(
      smsConsumeSchema.safeParse({ action: "peek", consumer: "closing" })
        .success,
    ).toBe(false);
  });

  it("소비자 셋 — 마감·경쟁률·정산 탐색", () => {
    expect([...SMS_CONSUMERS]).toEqual([
      "closing",
      "ratio-audit",
      "settlement-discover",
    ]);
  });
});
