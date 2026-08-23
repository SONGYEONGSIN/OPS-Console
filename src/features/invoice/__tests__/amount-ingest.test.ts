import { describe, it, expect } from "vitest";
import {
  invoiceAmountIngestSchema,
  selectAmountUpdates,
} from "../amount-ingest";

/**
 * Moa 정산 금액 인제스트.
 *
 * 스크래퍼가 어느 화면을 읽든 결과는 `(서비스ID, 금액)` 이어야 한다 — 우리 표가
 * 서비스 단위이기 때문이다. 그래서 이 계약은 Moa 화면 구조와 무관하다.
 *
 * 여기서 지키려는 것 둘:
 *
 * 1. **정산완료된 건에만 금액을 채운다.** 금액이 먼저 들어와 행이 생기면
 *    `settled_at` 없는 행이 만들어지고, 그건 계산서발행 목록의 전제를 깬다.
 * 2. **음수·비정수를 막는다.** 청구금액이 잘못 들어오면 사람이 그대로 발행한다.
 */
describe("invoiceAmountIngestSchema", () => {
  const ok = {
    scraped_at: "2026-08-24T10:00:00+09:00",
    rows: [{ service_id: 1234110, amount: 97500000 }],
  };

  it("정상 payload 를 받는다", () => {
    expect(invoiceAmountIngestSchema.safeParse(ok).success).toBe(true);
  });

  it("빈 배열을 거부한다 — 전량 0원 덮어쓰기 사고를 막는다", () => {
    const r = invoiceAmountIngestSchema.safeParse({ ...ok, rows: [] });
    expect(r.success).toBe(false);
  });

  it("음수 금액을 거부한다", () => {
    const r = invoiceAmountIngestSchema.safeParse({
      ...ok,
      rows: [{ service_id: 1, amount: -1 }],
    });
    expect(r.success).toBe(false);
  });

  it("0원은 받는다 — 실제로 0원인 정산이 있을 수 있고, 없는 값과는 다르다", () => {
    const r = invoiceAmountIngestSchema.safeParse({
      ...ok,
      rows: [{ service_id: 1, amount: 0 }],
    });
    expect(r.success).toBe(true);
  });

  it("소수점 금액을 거부한다 — 원 단위 정수다", () => {
    const r = invoiceAmountIngestSchema.safeParse({
      ...ok,
      rows: [{ service_id: 1, amount: 1000.5 }],
    });
    expect(r.success).toBe(false);
  });

  it("문자열 서비스ID 를 숫자로 받는다 — 엑셀에서 문자로 올라온다", () => {
    const r = invoiceAmountIngestSchema.safeParse({
      ...ok,
      rows: [{ service_id: "1234110", amount: 100 }],
    });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.rows[0].service_id).toBe(1234110);
  });

  it("빈 서비스ID 를 0 으로 만들지 않는다 — Number(null)===0 이라 엉뚱한 행을 덮는다", () => {
    const r = invoiceAmountIngestSchema.safeParse({
      ...ok,
      rows: [{ service_id: null, amount: 100 }],
    });
    expect(r.success).toBe(false);
  });

  it("시각이 없으면 거부한다 — 언제 받은 값인지 모르면 신선도를 못 따진다", () => {
    const r = invoiceAmountIngestSchema.safeParse({ rows: ok.rows });
    expect(r.success).toBe(false);
  });
});

describe("selectAmountUpdates", () => {
  const rows = [
    { service_id: 100, amount: 500 },
    { service_id: 200, amount: 700 },
    { service_id: 300, amount: 900 },
  ];

  it("정산완료된 건에만 금액을 붙인다", () => {
    const r = selectAmountUpdates(rows, [100, 300]);
    expect(r.updates.map((u) => u.service_id)).toEqual([100, 300]);
    expect(r.skipped).toEqual([200]);
  });

  it("정산완료가 없으면 아무것도 안 쓴다 — 금액이 먼저 들어와 행을 만들면 안 된다", () => {
    const r = selectAmountUpdates(rows, []);
    expect(r.updates).toEqual([]);
    expect(r.skipped).toEqual([100, 200, 300]);
  });

  it("서비스ID 0 도 정상 처리한다 — falsy 로 거르면 샌다", () => {
    const r = selectAmountUpdates([{ service_id: 0, amount: 10 }], [0]);
    expect(r.updates.map((u) => u.service_id)).toEqual([0]);
  });

  it("같은 서비스가 두 번 오면 마지막 값을 쓴다 — 회차가 나뉘어 오는 경우", () => {
    const r = selectAmountUpdates(
      [
        { service_id: 100, amount: 500 },
        { service_id: 100, amount: 800 },
      ],
      [100],
    );
    expect(r.updates).toHaveLength(1);
    expect(r.updates[0].amount).toBe(800);
  });
});
