import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import { similarity } from "../similarity";
import { normalizeName } from "../normalize";
import type { MisuRow, DepositRow } from "../types";

/**
 * mismatch(금액 일치·이름 불일치) 확인 요청의 유사도 판정은 **정규화된 이름** 기준이어야 한다.
 *
 * 실제 운영 오탐 (2026-08-04): 건양대학교 40,000원 청구 ↔ 한국항공대학교 40,000원 입금이
 * "확인 요청" 메일로 발송됐다. 두 대학은 아무 관계가 없다.
 *
 * 원인: 원본 이름끼리 비교하면 공유 접미사 '대학교'가 유사도를 부풀린다.
 * 임계값 0.4는 정규화 값 기준으로 보정된 값인데(algorithm.ts 주석의 근거표),
 * 구현이 원본을 넘겨 컷이 의도대로 동작하지 않았다.
 *
 *   건양대학교 ↔ 한국항공대학교   원본 0.429(통과) / 정규화 0.200(차단)
 *   가천대학교 ↔ 동국대학교       원본 0.600(통과) / 정규화 0.333(차단)
 *   서강대학교 ↔ 서강국제대학원   원본 0.571(통과) / 정규화 0.500(통과 — 진짜 별칭 후보)
 */

function misuRow(customer: string, amount: number): MisuRow {
  return {
    rowNumber: 2,
    date: "2026-07-14",
    customer,
    amount,
    note: "",
  } as MisuRow;
}

function depositRow(content: string, amount: number): DepositRow {
  return {
    row: 10,
    date: "2026-07-24",
    content,
    amount,
    matchedFlag: "",
  } as DepositRow;
}

describe("유사도 기준선 — 정규화 전후 차이", () => {
  it("공유 접미사 '대학교'가 원본 비교의 유사도를 부풀린다", () => {
    const raw = similarity("건양대학교", "한국항공대학교");
    const norm = similarity(
      normalizeName("건양대학교"),
      normalizeName("한국항공대학교"),
    );
    expect(raw).toBeGreaterThanOrEqual(0.4);
    expect(norm).toBeLessThan(0.4);
  });
});

describe("runMatch — mismatch 확인 요청 대상 판정", () => {
  it("무관한 대학끼리 금액만 같으면 확인 요청하지 않는다 (건양대 ↔ 한국항공대)", () => {
    const result = runMatch(
      [misuRow("건양대학교", 40000)],
      [depositRow("한국항공대학교", 40000)],
    );
    expect(result.matched).toHaveLength(0);
    expect(result.mismatches).toHaveLength(0);
  });

  it("무관한 대학끼리 금액만 같으면 확인 요청하지 않는다 (가천대 ↔ 동국대)", () => {
    const result = runMatch(
      [misuRow("가천대학교", 40000)],
      [depositRow("동국대학교", 40000)],
    );
    expect(result.mismatches).toHaveLength(0);
  });

  it("별칭 후보로 볼 만큼 유사하면 확인 요청한다 (서강대 ↔ 서강국제대학원)", () => {
    const result = runMatch(
      [misuRow("서강대학교", 40000)],
      [depositRow("서강국제대학원", 40000)],
    );
    expect(result.mismatches).toHaveLength(1);
    expect(result.mismatches[0].misuCustomer).toBe("서강대학교");
    expect(result.mismatches[0].depContent).toBe("서강국제대학원");
  });
});
