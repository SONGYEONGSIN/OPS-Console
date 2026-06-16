import { describe, it, expect } from "vitest";
import { resolveManager } from "../manager-rules";
import type { SmileEdiRow, SmileEdiMappingConfig } from "../types";

const config: SmileEdiMappingConfig = {
  itemKeywords: [],
  companyManager: { 고려대학교: "박시현" },
  managerEmail: {},
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
    status: "미승인",
    ...over,
  };
}

describe("resolveManager — get_manager_by_rules 포팅", () => {
  it("담당자명-공급자=조가현 최우선 (거래처 무관)", () => {
    expect(
      resolveManager(row({ supplierManager: "조가현", companyName: "서강대학교" }), config),
    ).toEqual({ managerName: "조가현", routedByDefault: false });
  });

  it("(학)연세대학교 + 품목 강사/채용 → 김유정", () => {
    expect(
      resolveManager(row({ companyName: "(학)연세대학교", item: "강사료" }), config).managerName,
    ).toBe("김유정");
  });

  it("(학)연세대학교 + 재무부(자체)/국제학대학원/고위정책 → 윤지혜", () => {
    expect(
      resolveManager(row({ companyName: "(학)연세대학교", receiverDept: "국제학대학원" }), config)
        .managerName,
    ).toBe("윤지혜");
  });

  it("(학)연세대학교 + 언더우드국제학부 → 송영신", () => {
    expect(
      resolveManager(row({ companyName: "(학)연세대학교", receiverDept: "언더우드국제학부" }), config)
        .managerName,
    ).toBe("송영신");
  });

  it("(학)연세대학교 기타 → 송영신 (규칙 매치, 폴백 아님)", () => {
    expect(
      resolveManager(row({ companyName: "(학)연세대학교", receiverDept: "총무부" }), config),
    ).toEqual({ managerName: "송영신", routedByDefault: false });
  });

  it("서강대학교 → 박시현 / 덕성여자대학교 → 김슬기 / 연세대학교 미래캠퍼스 → 김유정", () => {
    expect(resolveManager(row({ companyName: "서강대학교" }), config).managerName).toBe("박시현");
    expect(resolveManager(row({ companyName: "덕성여자대학교" }), config).managerName).toBe("김슬기");
    expect(
      resolveManager(row({ companyName: "연세대학교 미래캠퍼스" }), config).managerName,
    ).toBe("김유정");
  });

  it("companyManager 매핑에 있는 거래처 → 매핑값 (폴백 아님)", () => {
    expect(resolveManager(row({ companyName: "고려대학교" }), config)).toEqual({
      managerName: "박시현",
      routedByDefault: false,
    });
  });

  it("알 수 없는 거래처 → 기본 담당자 + routedByDefault=true", () => {
    expect(resolveManager(row({ companyName: "한양대학교" }), config)).toEqual({
      managerName: "송영신",
      routedByDefault: true,
    });
  });
});
