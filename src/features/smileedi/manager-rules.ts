import type { SmileEdiRow, SmileEdiMappingConfig } from "./types";

/**
 * 거래처명·담당부서·품목 조합으로 담당자명을 결정 — Tax_invoice.py `get_manager_by_rules` 포팅.
 * 미매핑 거래처는 기본 담당자(config.defaultManager, 원본 '송영신')로 폴백하되,
 * routedByDefault=true로 표시해 신규 거래처가 잡 결과에서 표면화되도록 한다.
 */
export function resolveManager(
  row: SmileEdiRow,
  config: SmileEdiMappingConfig,
): { managerName: string; routedByDefault: boolean } {
  const company = row.companyName.trim();
  const dept = row.receiverDept.trim();
  const item = row.item.trim();

  // 최우선: 담당자명-공급자 == 조가현
  if (row.supplierManager.trim() === "조가현") {
    return { managerName: "조가현", routedByDefault: false };
  }

  if (company === "(학)연세대학교") {
    if (item && ["강사", "채용"].some((kw) => item.includes(kw))) {
      return { managerName: "김유정", routedByDefault: false };
    }
    if (["재무부(자체)", "국제학대학원", "고위정책"].includes(dept)) {
      return { managerName: "윤지혜", routedByDefault: false };
    }
    if (dept === "언더우드국제학부") {
      return { managerName: "송영신", routedByDefault: false };
    }
    return { managerName: "송영신", routedByDefault: false };
  }

  if (company === "서강대학교") {
    return { managerName: "박시현", routedByDefault: false };
  }
  if (company === "덕성여자대학교") {
    return { managerName: "김슬기", routedByDefault: false };
  }
  if (company === "연세대학교 미래캠퍼스") {
    return { managerName: "김유정", routedByDefault: false };
  }

  const mapped = config.companyManager[company];
  if (mapped) {
    return { managerName: mapped, routedByDefault: false };
  }

  return { managerName: config.defaultManager, routedByDefault: true };
}
