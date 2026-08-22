import type { ClosingRow } from "@/features/closing/schemas";
import { settlementDueAt, daysLeft } from "./deadline";

/**
 * 정산 목록 한 줄 — 결제 끝난 서비스에 **대학별 기한**을 붙여 마감일을 만든다.
 *
 * 이 붙이기가 정산 메뉴의 존재 이유다. 안 붙이면 `listClosing` 이 이미
 * `pay_end_at` 으로 거르므로 서비스마감과 같은 목록이 된다.
 */
export type SettlementRow = ClosingRow & {
  /** 그 대학의 정산기한(일). 안 정해졌으면 null. */
  deadlineDays: number | null;
  /** 결제마감 + 기한. 기한이 없으면 null. */
  dueAt: string | null;
  /** 마감일까지 남은 날. 지났으면 음수. */
  daysLeft: number | null;
};

export function toSettlementRows(
  services: readonly ClosingRow[],
  /** 대학명 → 정산기한(일). */
  deadlines: Record<string, number>,
  now: Date = new Date(),
): SettlementRow[] {
  return services.map((s) => {
    // 기한이 없는 대학은 마감일을 만들지 않는다. 지어내면 안 지난 건이 지난 것처럼
    // 보이거나 그 반대가 되고, 그게 정산에서 가장 나쁜 오류다.
    const deadlineDays = deadlines[s.university_name] ?? null;
    const dueAt = settlementDueAt(s.pay_end_at, deadlineDays);
    return { ...s, deadlineDays, dueAt, daysLeft: daysLeft(dueAt, now) };
  });
}
