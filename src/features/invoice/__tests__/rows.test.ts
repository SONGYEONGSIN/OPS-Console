import { describe, it, expect } from "vitest";
import { toInvoiceRows, formatBilledAmount, ISSUE_TYPES } from "../rows";

const svc = (over: Record<string, unknown> = {}) =>
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
 * 계산서발행 목록 = **정산완료된 서비스** + 발행 기록.
 *
 * 목록 범위는 서버 쿼리가 이미 정산완료로 좁힌다. 여기서 하는 일은 발행 기록을
 * 붙이는 것이고, 없으면 '아직 발행 안 함'이다.
 */
describe("toInvoiceRows", () => {
  it("발행 기록을 붙인다", () => {
    const [r] = toInvoiceRows([svc()], {
      100: {
        settledAt: "2026-08-20T00:00:00Z",
        issuedAt: "2026-08-24T00:00:00Z",
        issueType: "청구",
        billedAmount: 97500000,
      },
    });
    expect(r.issuedAt).toBe("2026-08-24T00:00:00Z");
    expect(r.issueType).toBe("청구");
    expect(r.billedAmount).toBe(97500000);
    expect(r.settledAt).toBe("2026-08-20T00:00:00Z");
  });

  it("기록이 없으면 전부 null — 아직 발행 안 했다는 뜻이다", () => {
    const [r] = toInvoiceRows([svc()], {});
    expect(r.issuedAt).toBeNull();
    expect(r.issueType).toBeNull();
    expect(r.billedAmount).toBeNull();
  });

  it("서비스ID 0 도 붙는다 — falsy 로 거르면 통째로 샌다", () => {
    const [r] = toInvoiceRows([svc({ service_id: 0 })], {
      0: {
        settledAt: "2026-08-20T00:00:00Z",
        issuedAt: null,
        issueType: null,
        billedAmount: null,
      },
    });
    expect(r.settledAt).toBe("2026-08-20T00:00:00Z");
  });

  it("원본을 바꾸지 않는다", () => {
    const rows = [svc()];
    toInvoiceRows(rows, {});
    expect(rows[0]).not.toHaveProperty("issuedAt");
  });
});

/**
 * 청구금액은 Moa 에서 가져온다. **연동 전까지 null 이고, null 은 0 이 아니다.**
 *
 * 0 으로 보이면 "청구할 게 없다"로 읽혀 발행을 건너뛰게 된다.
 */
describe("formatBilledAmount", () => {
  it("금액은 세 자리마다 끊는다", () => {
    expect(formatBilledAmount(97500000)).toBe("97,500,000");
    expect(formatBilledAmount(4300)).toBe("4,300");
  });

  it("없는 값은 0 이 아니라 빈 자리로 보여준다", () => {
    expect(formatBilledAmount(null)).toBe("—");
  });

  it("진짜 0 원은 0 으로 보여준다 — 없는 것과 다르다", () => {
    expect(formatBilledAmount(0)).toBe("0");
  });
});

describe("ISSUE_TYPES", () => {
  it("인수인계 폼과 같은 선택지를 쓴다 — 갈라지면 어느 쪽이 맞는지 모른다", () => {
    expect([...ISSUE_TYPES]).toEqual(["학생부담", "청구", "영수"]);
  });
});
