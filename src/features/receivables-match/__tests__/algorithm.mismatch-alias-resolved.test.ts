import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import type { MisuRow, DepositRow } from "../types";

/**
 * mismatch 확인 요청 — 별칭으로 정체가 해소된 입금 거래내용은 제외한다.
 *
 * 실제 운영 오탐 (2026-08-04): 한남대학교 15,000원 청구 ↔ 국제관광대학원 15,000원 입금이
 * 확인 요청으로 발송됐다. `국제관광대학원`은 SPECIAL_MAP에 한양대 별칭으로 등록돼 있어
 * 정규화하면 `한양대`가 되는데, `한남대`와 3글자 중 1글자만 달라 유사도가 0.667로 높다.
 *
 * 짧은 이름에서 Levenshtein은 1글자 차이를 크게 보지 않는다. 유사도를 더 조이면
 * 미등록 변형(가톨릭관동대학교 ↔ 관동대, 정규화 0.500)까지 함께 사라진다.
 *
 * 별칭에 걸렸다는 것은 "이 입금이 어느 대학인지 이미 안다"는 뜻이다. 아는 이름이
 * 미수 거래처와 다르면 표기 변형 후보가 아니라 그냥 다른 대학이므로 물어볼 이유가 없다.
 */

function misuRow(customer: string, amount: number): MisuRow {
  return {
    rowNumber: 2,
    date: "2026-07-16",
    customer,
    amount,
    note: "",
  } as MisuRow;
}

function depositRow(content: string, amount: number): DepositRow {
  return {
    row: 10,
    date: "2026-07-29",
    content,
    amount,
    matchedFlag: "",
  } as DepositRow;
}

describe("runMatch — 별칭 해소된 입금 거래내용은 확인 요청에서 제외", () => {
  it("별칭이 다른 대학으로 해소되면 확인 요청하지 않는다 (한남대 ↔ 국제관광대학원)", () => {
    const result = runMatch(
      [misuRow("한남대학교", 15000)],
      [depositRow("국제관광대학원", 15000)],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.mismatches).toHaveLength(0);
  });

  it("학습 alias로 해소된 경우도 제외한다", () => {
    const result = runMatch(
      [misuRow("한남대학교", 15000)],
      [depositRow("무슨무슨센터", 15000)],
      { 무슨무슨센터: "한양대" },
    );
    expect(result.mismatches).toHaveLength(0);
  });

  it("별칭에 없는 미등록 변형은 그대로 확인 요청한다 (한국외국어대 ↔ 한국외대)", () => {
    // 부분포함이 아니라 강매칭에서 걸러지고(한국외국어대 ⊅ 한국외대), 별칭에도 없으며,
    // 정규화 유사도 0.667로 임계값을 넘는다 — 딱 확인 요청 대상이다.
    const result = runMatch(
      [misuRow("한국외국어대학교", 15000)],
      [depositRow("한국외대", 15000)],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].depContent).toBe("한국외대");
  });

  it("별칭이 미수 거래처와 같은 대학으로 해소되면 자동 매칭된다 (제외 규칙에 걸리지 않음)", () => {
    const result = runMatch(
      [misuRow("한양대학교", 15000)],
      [depositRow("국제관광대학원", 15000)],
    );
    expect(result.matched).toHaveLength(1);
    expect(result.mismatches).toHaveLength(0);
  });
});
