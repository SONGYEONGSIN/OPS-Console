import type { ContractRow } from "./schemas";

/** 계약정보 자동 채움용 경량 매치 결과. */
export type ContractMatch = {
  sheet: string;
  numbering: string;
  name: string;
  operator: string;
  status: string;
  feeAmount: string;
};

/**
 * 계약 행에서 학교명 부분일치 항목만 추려 경량 매치로 변환한다.
 * 인스펙터 계약정보 검색→자동 채움(진행/상태)에서 사용.
 */
export function matchContractsByName(
  rows: ContractRow[],
  name: string,
  limit = 15,
): ContractMatch[] {
  const term = name.trim();
  if (!term) return [];
  return rows
    .filter((r) => r.name && r.name.includes(term))
    .slice(0, limit)
    .map((r) => ({
      sheet: r.sheet,
      numbering: r.numbering,
      name: r.name,
      operator: r.operator,
      status: r.status,
      feeAmount: r.feeAmount,
    }));
}
