import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/mail/brand-logo", () => ({
  brandLogoImg: () => "<img alt='logo'/>",
}));

import {
  buildSmileEdiSubject,
  buildSmileEdiHtml,
  formatAmount,
  sumSupplyAmount,
} from "../mail-template";
import type { SmileEdiGroup } from "../types";

const group: SmileEdiGroup = {
  managerName: "박시현",
  recipientEmail: "park@jinhakapply.com",
  routedByDefault: false,
  rows: [
    {
      excelRow: 4,
      writeDate: "2026.04.01",
      item: "수수료",
      supplyAmount: "1000000",
      taxAmount: "100000",
      companyName: "서강대학교",
      receiverDept: "입학처",
      supplierManager: "",
      approvalNumber: "A-1",
      emailError: "",
    },
  ],
};

describe("smileedi mail-template", () => {
  it("제목 — 브랜드 + 담당자", () => {
    expect(buildSmileEdiSubject("박시현")).toBe(
      "[운영부 상황실] 역발행 세금계산서 발행 안내 (박시현님)",
    );
  });

  it("formatAmount — 천단위 콤마", () => {
    expect(formatAmount("1000000")).toBe("1,000,000");
    expect(formatAmount("")).toBe("");
  });

  it("sumSupplyAmount — 공급가액 합계", () => {
    expect(sumSupplyAmount(group)).toBe(1000000);
  });

  it("HTML — 브랜드/담당자/거래처/금액 포함", () => {
    const html = buildSmileEdiHtml(group);
    expect(html).toContain("역발행 세금계산서 발행 안내");
    expect(html).toContain("박시현");
    expect(html).toContain("서강대학교");
    expect(html).toContain("1,000,000");
  });

  it("HTML — 안내 문구 (K시스템 전표 + 김승현 매니저 작성완료 회신)", () => {
    const html = buildSmileEdiHtml(group);
    expect(html).toContain("K시스템 전표 작성해 주세요");
    expect(html).toContain("김승현 매니저에게 작성완료 메일 회신해 주세요");
    expect(html).not.toContain("박시현 매니저");
  });
});
