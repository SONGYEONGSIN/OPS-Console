import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderQuotePdf } from "../quote-pdf";
import { blankDocument } from "@/features/quotes/document-schema";

describe("renderQuotePdf", () => {
  it("4섹션 blankDocument(dev) → PDF 버퍼 생성", async () => {
    const doc = blankDocument("dev");
    const buf = await renderToBuffer(
      renderQuotePdf({ document: doc, customer: "가천대" }),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("section.note + guide 포함 4섹션 → PDF 버퍼 생성", async () => {
    const base = blankDocument("dev");
    const doc = {
      ...base,
      header: {
        ...base.header,
        recipient: "가천대학교",
        quoteName: "입학 시스템 구축",
        recipientCount: "1,200명",
        managerTel: "02-1234-5678",
        managerEmail: "ops@jinhak.com",
      },
      sections: base.sections.map((s) =>
        s.id === "system"
          ? {
              ...s,
              note: "월 단위 인프라 사용료 기준입니다.",
              rows: [
                { category: "서버", item: "웹서버", qty: 2, months: 3, unit: 100000, amount: null },
              ],
            }
          : s,
      ),
      guide: ["부가세 별도입니다.", "유효기간 내 계약 시 단가 보장."],
    };
    const buf = await renderToBuffer(
      renderQuotePdf({ document: doc, customer: "가천대" }),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });

  it("labor 문서 → PDF 버퍼 생성(적산 포함)", async () => {
    const base = blankDocument("labor");
    const doc = {
      ...base,
      sections: base.sections.map((s) =>
        s.kind === "labor"
          ? { ...s, rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }] }
          : s,
      ),
    };
    const buf = await renderToBuffer(
      renderQuotePdf({ document: doc, customer: "국평원" }),
    );
    expect(buf.length).toBeGreaterThan(1000);
  });
});
