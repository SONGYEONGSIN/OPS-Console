import { z } from "zod";

/**
 * 우편함을 쓰는 스크래퍼. 로그인 점유(리스)가 이 이름으로 구분되므로 오타 하나가
 * 점유를 무력화한다 — 등록된 이름만 받고 나머지는 400 이다.
 */
export const SMS_CONSUMERS = [
  "closing",
  "ratio-audit",
  "settlement-discover",
] as const;
export type SmsConsumer = (typeof SMS_CONSUMERS)[number];

export const smsConsumeSchema = z.object({
  action: z.enum(["reset", "pop"]),
  consumer: z.enum(SMS_CONSUMERS),
});

/** 폰이 보내는 문자 원문. 길이만 본다 — 판정은 extractSmsCode 가 한다. */
export const smsInboundBodySchema = z.string().min(1).max(2000);

/** 저장되는 값의 모양. DB check 제약(`^[0-9]{4,8}$`)과 같다. */
export const smsCodeSchema = z.string().regex(/^[0-9]{4,8}$/);
