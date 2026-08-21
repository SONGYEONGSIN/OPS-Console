import { z } from "zod";

/**
 * 판독 결과(JSON 문자열) → 검증된 값.
 *
 * **모델이 보낸 것을 그대로 믿지 않는다.** 스키마로 걸러 카드 관련 값이 섞여 와도
 * 버리고(zod가 모르는 키를 떨어뜨린다), 합계를 검산해 잘못 읽은 것을 사람이 보기
 * 전에 표시한다.
 */

const itemSchema = z.object({
  // 이게 없으면 엑셀에 쓸 수 없다 — 행의 존재 이유다.
  tracking_no: z.string().trim().min(1),
  fee: z.number().int().nonnegative().nullable().catch(null),
  postal_code: z.string().trim().nullable().catch(null),
  recipient_org: z.string().trim().nullable().catch(null),
  recipient_name: z.string().trim().nullable().catch(null),
});

const extractionSchema = z.object({
  is_receipt: z.boolean(),
  receipt_no: z.string().trim().nullable().catch(null),
  accepted_at: z.string().trim().nullable().catch(null),
  total_fee: z.number().int().nonnegative().nullable().catch(null),
  /**
   * 카드 승인금액. 개별 요금 합과 다를 수 있는데, **장부에 적을 것은 실제로 결제된
   * 돈**이라 이쪽이 기준이다(2026-08-21 지정).
   */
  approved_amount: z.number().int().nonnegative().nullable().catch(null),
  item_count: z.number().int().nonnegative().nullable().catch(null),
  items: z.array(itemSchema).default([]),
});

export type Extraction = z.infer<typeof extractionSchema>;

export type ParseResult =
  | { ok: true; data: Extraction; warnings: string[] }
  | { ok: false; error: string };

/**
 * 답에서 JSON 덩어리만 꺼낸다.
 *
 * "JSON만 답하라"고 해도 모델은 앞뒤에 말을 붙인다 — 실제로 `I'll open the
 * receipt image first.` 를 먼저 말하고 JSON을 냈다. 코드펜스로 감싸기도 한다.
 * 첫 `{` 부터 마지막 `}` 까지를 잘라 쓴다.
 */
function extractJsonBlock(s: string): string {
  const noFence = s
    .trim()
    .replace(/```(?:json)?/gi, "")
    .trim();
  const start = noFence.indexOf("{");
  const end = noFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return noFence;
  return noFence.slice(start, end + 1);
}

export function parseExtraction(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(extractJsonBlock(raw));
  } catch {
    return { ok: false, error: "판독 결과를 읽을 수 없습니다 (JSON 아님)" };
  }

  const parsed = extractionSchema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      error: `판독 결과 형식 오류: ${parsed.error.issues[0].message}`,
    };
  }
  if (!parsed.data.is_receipt) {
    return { ok: false, error: "우체국 등기 영수증이 아닙니다" };
  }
  if (parsed.data.items.length === 0) {
    return { ok: false, error: "등기 건을 하나도 읽지 못했습니다" };
  }

  // 검산 — 막지는 않는다. 사람이 검토 화면에서 고칠 수 있다.
  const warnings: string[] = [];
  const sum = parsed.data.items.reduce((a, i) => a + (i.fee ?? 0), 0);
  if (parsed.data.total_fee != null && sum !== parsed.data.total_fee) {
    warnings.push(
      `합계가 맞지 않습니다 — 개별 요금 합 ${sum.toLocaleString("ko-KR")}원 ≠ 총요금 ${parsed.data.total_fee.toLocaleString("ko-KR")}원`,
    );
  }
  if (
    parsed.data.item_count != null &&
    parsed.data.item_count !== parsed.data.items.length
  ) {
    warnings.push(
      `건수가 맞지 않습니다 — 읽은 ${parsed.data.items.length}건 ≠ 영수증 ${parsed.data.item_count}통`,
    );
  }

  // 승인금액이 있으면 그걸 총액으로 쓴다 — 실제로 결제된 돈이다.
  // 어긋난 사실은 경고로 남긴다: 조용히 고르면 왜 다른지 아무도 안 본다.
  const approved = parsed.data.approved_amount;
  if (approved != null && parsed.data.total_fee != null && approved !== parsed.data.total_fee) {
    warnings.push(
      `승인금액과 총요금이 다릅니다 — 승인 ${approved.toLocaleString("ko-KR")}원 기준으로 적습니다 (총요금 ${parsed.data.total_fee.toLocaleString("ko-KR")}원)`,
    );
  }
  const data = {
    ...parsed.data,
    total_fee: approved ?? parsed.data.total_fee,
  };
  return { ok: true, data, warnings };
}

/**
 * 엑셀 '순번' — 그날 몇 번째 건인가.
 *
 * 접수일자 기준이라 같은 날 영수증이 여러 장이면 이어서 붙는다.
 * 한 영수증 안에서는 등기번호 순이다.
 */
export function assignDaySeq(
  items: { tracking_no: string }[],
  alreadyOnThatDay: number,
): number[] {
  const order = items
    .map((it, idx) => ({ idx, no: it.tracking_no }))
    .sort((a, b) => a.no.localeCompare(b.no));
  const seq = new Array<number>(items.length);
  order.forEach((o, k) => {
    seq[o.idx] = alreadyOnThatDay + k + 1;
  });
  return seq;
}
