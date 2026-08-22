import { describe, it, expect } from "vitest";
import { toSettlementRows } from "../rows";

const NOW = new Date("2026-08-22T00:00:00Z");

const svc = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: "1",
    service_id: 100,
    university_name: "충청대학교",
    service_name: "2027 수시",
    operator_name: "김담당",
    pay_end_at: "2026-08-01T00:00:00Z",
    ...over,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any;

/**
 * 정산 목록 = 결제 끝난 서비스 + 대학별 기한 → 정산 마감일·남은 날.
 *
 * 기한이 없는 대학은 마감일을 못 만든다. 그때 지어내면 안 지난 건이 지난 것처럼
 * 보이거나 그 반대가 된다 — 비워두고 사람이 정하게 한다.
 */
describe("정산 행 만들기", () => {
  it("대학 기한으로 마감일과 남은 날을 채운다", () => {
    const [r] = toSettlementRows([svc()], { 충청대학교: 10 }, NOW);
    expect(r.deadlineDays).toBe(10);
    expect(r.dueAt).toBe("2026-08-11T00:00:00.000Z");
    expect(r.daysLeft).toBe(-11); // 이미 지났다
  });

  it("기한이 없으면 비워둔다 — 지어내면 늦은 건을 놓친다", () => {
    const [r] = toSettlementRows([svc()], {}, NOW);
    expect(r.deadlineDays).toBeNull();
    expect(r.dueAt).toBeNull();
    expect(r.daysLeft).toBeNull();
  });

  it("대학 이름으로 붙인다 — 같은 대학의 여러 서비스가 같은 기한을 쓴다", () => {
    const rows = toSettlementRows(
      [svc({ id: "1", service_name: "수시" }), svc({ id: "2", service_name: "정시" })],
      { 충청대학교: 20 },
      NOW,
    );
    expect(rows.map((r) => r.deadlineDays)).toEqual([20, 20]);
  });

  it("모르는 대학의 기한은 무시한다", () => {
    const [r] = toSettlementRows([svc()], { 다른대학교: 5 }, NOW);
    expect(r.deadlineDays).toBeNull();
  });

  it("원래 값은 그대로 들고 간다 — 표에 그대로 쓴다", () => {
    const [r] = toSettlementRows([svc()], { 충청대학교: 5 }, NOW);
    expect(r.university_name).toBe("충청대학교");
    expect(r.operator_name).toBe("김담당");
    expect(r.pay_end_at).toBe("2026-08-01T00:00:00Z");
  });
});
