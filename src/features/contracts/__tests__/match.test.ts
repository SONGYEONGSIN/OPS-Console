import { describe, it, expect } from "vitest";
import { matchContractsByName } from "../match";
import type { ContractRow } from "../schemas";

function row(over: Partial<ContractRow>): ContractRow {
  return {
    id: "4년제-2",
    sheet: "4년제",
    excelRowNumber: 2,
    numbering: "D-1-01",
    name: "건국대학교",
    operator: "송영신",
    status: "계약완료",
    serviceActive: "Y",
    feeAmount: "1,100,000",
    cellAddress: {
      operator: null,
      status: null,
      serviceActive: null,
      feeAmount: null,
    },
    raw: {},
    ...over,
  };
}

describe("matchContractsByName", () => {
  const rows = [
    row({ id: "a", name: "건국대학교", operator: "송영신", status: "계약완료" }),
    row({ id: "b", name: "건국대학교 글로컬", operator: "허승철", status: "" }),
    row({ id: "c", name: "부산대학교", operator: "김운영" }),
    row({ id: "d", name: "", numbering: "" }),
  ];

  it("이름 부분일치 행만 반환 (빈 행 제외)", () => {
    const m = matchContractsByName(rows, "건국");
    expect(m).toHaveLength(2);
    expect(m.map((r) => r.name)).toEqual(["건국대학교", "건국대학교 글로컬"]);
  });

  it("operator/status를 매치에 포함", () => {
    const m = matchContractsByName(rows, "건국");
    expect(m[0]).toMatchObject({
      name: "건국대학교",
      operator: "송영신",
      status: "계약완료",
    });
  });

  it("공백 검색어는 빈 배열", () => {
    expect(matchContractsByName(rows, "   ")).toEqual([]);
  });

  it("limit 적용", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      row({ id: `x${i}`, name: `테스트대학 ${i}` }),
    );
    expect(matchContractsByName(many, "테스트", 5)).toHaveLength(5);
  });
});
