import { describe, it, expect } from "vitest";
import {
  SMS_CONSUMERS,
  smsCodeSchema,
  smsConsumeSchema,
  smsInboundBodySchema,
} from "../schemas";

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

describe("smsInboundBodySchema — 폰이 보내는 원문", () => {
  it("길이만 본다 — 판정은 extractSmsCode 가 한다", () => {
    expect(smsInboundBodySchema.safeParse("아무 문자").success).toBe(true);
  });
  it("빈 본문과 2000자 초과는 거절", () => {
    expect(smsInboundBodySchema.safeParse("").success).toBe(false);
    expect(smsInboundBodySchema.safeParse("x".repeat(2001)).success).toBe(
      false,
    );
  });
});

describe("smsCodeSchema — 저장 직전 마지막 관문", () => {
  it("숫자 4~8자리만", () => {
    expect(smsCodeSchema.safeParse("130753").success).toBe(true);
    expect(smsCodeSchema.safeParse("12ab56").success).toBe(false);
    expect(smsCodeSchema.safeParse("123").success).toBe(false);
  });
});
