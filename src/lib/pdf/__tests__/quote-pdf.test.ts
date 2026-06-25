import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { renderQuotePdf } from "../quote-pdf";
import { blankDocument } from "@/features/quotes/document-schema";

describe("renderQuotePdf", () => {
  it("dev 문서 → PDF 버퍼 생성", async () => {
    const doc = {
      ...blankDocument("dev"),
      sections: [{ id: "main", title: "견적 내역", kind: "simple" as const,
        columns: blankDocument("dev").sections[0].columns,
        rows: [{ category: "개발", detail: "시스템 구축", note: "", amount: 1000000 }], subtotal: 0 }],
    };
    const buf = await renderToBuffer(renderQuotePdf({ document: doc, customer: "가천대" }));
    expect(buf.length).toBeGreaterThan(1000);
  });
  it("labor 문서 → PDF 버퍼 생성(적산 포함)", async () => {
    const doc = {
      ...blankDocument("labor"),
      sections: blankDocument("labor").sections.map((s) => ({
        ...s, rows: [{ role: "기획", count: 1, daily: 578206, days: 10, ratio: 1, direct: null }],
      })),
    };
    const buf = await renderToBuffer(renderQuotePdf({ document: doc, customer: "국평원" }));
    expect(buf.length).toBeGreaterThan(1000);
  });
});
