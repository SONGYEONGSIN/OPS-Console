import { describe, it, expect } from "vitest";
import { groupByManager } from "../grouping";
import type { SmileEdiRow, SmileEdiMappingConfig } from "../types";

const config: SmileEdiMappingConfig = {
  itemKeywords: [],
  companyManager: {},
  managerEmail: { 박시현: "park@jinhakapply.com", 송영신: "song@jinhakapply.com" },
  defaultManager: "송영신",
};

function row(over: Partial<SmileEdiRow>): SmileEdiRow {
  return {
    excelRow: 4,
    writeDate: "",
    item: "",
    supplyAmount: "",
    taxAmount: "",
    companyName: "",
    receiverDept: "",
    contactName: "",
    contactPhone: "",
    contactEmail: "",
    supplierManager: "",
    approvalNumber: "",
    emailError: "",
    ...over,
  };
}

describe("groupByManager", () => {
  it("동일 담당자 통합 — 서강대 2건 → 박시현 1그룹 2행", () => {
    const r = groupByManager(
      [row({ companyName: "서강대학교", excelRow: 4 }), row({ companyName: "서강대학교", excelRow: 5 })],
      config,
    );
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({
      managerName: "박시현",
      recipientEmail: "park@jinhakapply.com",
      routedByDefault: false,
    });
    expect(r.groups[0].rows).toHaveLength(2);
  });

  it("managerEmail 미해결 담당자 → unresolvedManagers로 분리 (발송 그룹 제외)", () => {
    // 덕성여대 → 김슬기, 단 managerEmail 매핑 없음
    const r = groupByManager([row({ companyName: "덕성여자대학교" })], config);
    expect(r.groups).toHaveLength(0);
    expect(r.unresolvedManagers).toEqual([
      { managerName: "김슬기", companyNames: ["덕성여자대학교"] },
    ]);
  });

  it("미매핑 거래처 → 기본 담당자(송영신) 그룹 + routedByDefault=true", () => {
    const r = groupByManager([row({ companyName: "한양대학교" })], config);
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0]).toMatchObject({ managerName: "송영신", routedByDefault: true });
  });
});
