import { z } from "zod";

/**
 * Moa 정산 금액 인제스트 — 계약과 적재 규칙.
 *
 * 스크래퍼가 Moa 의 어느 화면을 읽든 결과는 `(서비스ID, 금액)` 이어야 한다.
 * 우리 표(`service_billing`)가 서비스 단위이기 때문이고, 그래서 이 계약은 Moa
 * 화면 구조가 정해지기 전에도 확정할 수 있다.
 */

export const invoiceAmountRowSchema = z.object({
  /**
   * 엑셀에서 문자로 올라오므로 숫자로 바꾼다.
   *
   * `z.coerce.number()` 는 쓰지 않는다 — `Number(null) === 0` 이라 빈 칸이 0 이 되고,
   * 서비스ID 0 인 엉뚱한 행을 덮는다 (오픈안내에서 같은 함정을 겪었다).
   */
  service_id: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number().int(),
  ),
  /** 원 단위 정수. 0 원은 실제로 있을 수 있고 '없음'(null)과 다르다. */
  amount: z.number().int().min(0),
});

export const invoiceAmountIngestSchema = z.object({
  scraped_at: z.string().datetime({ offset: true }),
  // 빈 배열 거부 — 전량 덮어쓰기 사고 방지 (closing 인제스트와 같은 이유).
  rows: z.array(invoiceAmountRowSchema).min(1),
});

export type InvoiceAmountRow = z.infer<typeof invoiceAmountRowSchema>;

/**
 * 실제로 쓸 행만 고른다.
 *
 * **정산완료된 건에만 금액을 채운다.** 금액이 먼저 들어와 행이 생기면 `settled_at`
 * 없는 행이 만들어지고, 그건 계산서발행 목록("정산 끝난 것만")의 전제를 깬다.
 * 건너뛴 것은 숨기지 않고 돌려줘 응답에 드러낸다 — 조용히 버리면 왜 금액이 안
 * 들어왔는지 알 길이 없다.
 */
export function selectAmountUpdates(
  rows: readonly InvoiceAmountRow[],
  settledServiceIds: readonly number[],
): { updates: InvoiceAmountRow[]; skipped: number[] } {
  const settled = new Set(settledServiceIds);

  // 같은 서비스가 여러 줄로 오면(회차가 나뉘는 경우) 마지막 값을 쓴다.
  const latest = new Map<number, InvoiceAmountRow>();
  const skipped: number[] = [];
  for (const r of rows) {
    if (!settled.has(r.service_id)) {
      if (!skipped.includes(r.service_id)) skipped.push(r.service_id);
      continue;
    }
    latest.set(r.service_id, r);
  }

  return { updates: [...latest.values()], skipped };
}
