/**
 * 전형료 정산 마감일 계산.
 *
 * 서비스마감 화면은 **작성마감** 기준으로 남은 날을 센다. 정산은 기준이 다르다 —
 * 결제가 끝난 뒤 **대학마다 정한 기한**(5·10·20·30일) 안에 정산해야 한다.
 *
 * 이 계산이 정산 메뉴의 존재 이유다. 없으면 서비스마감과 같은 목록이 된다
 * (`listClosing` 이 이미 `pay_end_at` 기준으로 거른다).
 */

/** 인수인계 폼(`handover/payment-fields.ts`)의 정산기한과 같은 값. */
export const DEADLINE_DAYS = [5, 10, 20, 30] as const;

const DAY_MS = 86_400_000;

/** 결제마감 + 기한. 둘 중 하나라도 없으면 마감일을 만들지 않는다. */
export function settlementDueAt(
  payEndAt: string | null | undefined,
  days: number | null | undefined,
): string | null {
  if (!payEndAt || days == null) return null;
  const t = Date.parse(payEndAt);
  if (Number.isNaN(t)) return null;
  return new Date(t + days * DAY_MS).toISOString();
}

/**
 * 마감일까지 남은 날. 지났으면 음수 — **늦은 건이 드러나야 한다.**
 *
 * 시각이 아니라 날짜로 센다. 같은 날이면 몇 시든 0이어야 "오늘까지"로 읽힌다.
 */
export function daysLeft(
  dueAt: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!dueAt) return null;
  const t = Date.parse(dueAt);
  if (Number.isNaN(t)) return null;
  const day = (ms: number) => Math.floor(ms / DAY_MS);
  return day(t) - day(now.getTime());
}
