import type { ContractInfo } from "@/features/handover/schemas";

/**
 * 계약(contracts) 행의 상태값을 계약정보 폼에 매핑한다.
 * - 제목: 항상 '원서접수' 고정
 * - 진행: 상태가 영업팀진행/입찰 → '영업', 그 외 → '운영'
 * - 형태: 진행이 '영업'이면 '입찰', 그 외 → '수의'
 * - 상태: 계약 상태값 그대로
 * 메모 등 나머지 필드는 유지한다.
 */
export function applyContractMatch(
  value: ContractInfo,
  contractStatus: string,
): ContractInfo {
  const status = contractStatus.trim();
  const isSales = status === "영업팀진행" || status === "입찰";
  return {
    ...value,
    title: "원서접수",
    type: isSales ? "입찰" : "수의",
    progress: isSales ? "영업" : "운영",
    status: contractStatus,
  };
}
