import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import type { MisuRow, DepositRow } from "../types";

/**
 * 명지대학교 청구 ↔ 명지인문대학원 입금.
 *
 * 2026-08-19 확인 요청 2건(120,000 / 55,000)이 이 표기 차이로 보류됐다. 금액은
 * 정확히 맞는데 입금 거래내용이 산하 대학원 이름이라 자동 매칭이 서지 않았다.
 * `명지특수대학원` 은 이미 같은 이유로 등록돼 있다 — 그 형제 격이다.
 *
 * 같은 날 같은 거래처에서 두 건이 오는 게 이 건의 모양이라, 한 건이 아니라
 * **두 건 모두** 각자의 금액과 짝지어지는지를 본다.
 */

const misu = (row: number, amount: number): MisuRow =>
  ({
    rowNumber: row,
    date: "2026-08-11",
    customer: "명지대학교",
    amount,
    note: "",
  }) as MisuRow;

const dep = (row: number, amount: number): DepositRow =>
  ({
    row,
    date: "2026-08-19",
    content: "명지인문대학원",
    amount,
    matchedFlag: "",
  }) as DepositRow;

describe("runMatch — 명지인문대학원 입금", () => {
  it("두 건이 각자의 금액과 짝지어진다", () => {
    const result = runMatch([misu(2, 120000), misu(3, 55000)], [
      dep(10, 120000),
      dep(11, 55000),
    ]);

    expect(result.matched).toHaveLength(2);
    const pairs = result.matched.map((p) => [p.misuRows, p.depRows]);
    expect(pairs).toContainEqual([[2], [10]]);
    expect(pairs).toContainEqual([[3], [11]]);
  });

  it("확인 요청이 남지 않는다 — 이 알림이 다시 오면 안 된다", () => {
    const result = runMatch([misu(2, 120000), misu(3, 55000)], [
      dep(10, 120000),
      dep(11, 55000),
    ]);
    expect(result.mismatches).toHaveLength(0);
  });
});
