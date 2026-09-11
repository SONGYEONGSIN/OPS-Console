import type { SmsConsumer } from "./schemas";

/** 로그인 점유 TTL — 폴링 상한 90초 + 여유. 폴러가 pop 전에 죽어도 3분이면 풀린다. */
export const INBOX_TTL_SEC = 180;

export const CLAIM_RPC = "claim_sms_inbox";
export const POP_RPC = "pop_sms_code";

/**
 * rpc 인자 — 키가 곧 마이그레이션의 파라미터 이름이다.
 *
 * 라우트 테스트는 mock 에 대고 단언하므로 이름이 하나만 어긋나도 초록인 채로
 * 프로덕션에서 500 이 난다. `rpc.test.ts` 가 SQL 원문과 대조한다.
 */
export function claimArgs(consumer: SmsConsumer, ttlSec = INBOX_TTL_SEC) {
  return { p_consumer: consumer, p_ttl_sec: ttlSec };
}
export function popArgs(consumer: SmsConsumer) {
  return { p_consumer: consumer };
}

/** `returns table` 컬럼. 아래 Row 타입의 키와 같아야 한다. */
export const CLAIM_ROW_COLUMNS = [
  "acquired",
  "holder",
  "holder_since",
  "cleared",
] as const;
export const POP_ROW_COLUMNS = ["code", "received_at"] as const;

export type ClaimRow = {
  acquired: boolean;
  holder: string | null;
  holder_since: string | null;
  cleared: number;
};
export type PopRow = { code: string; received_at: string };
