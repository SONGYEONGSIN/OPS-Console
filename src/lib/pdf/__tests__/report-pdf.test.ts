import { describe, it, expect } from "vitest";
import { renderReportPdf } from "../report-pdf";
import type { ReportRow } from "@/features/reports/schemas";

const sample: ReportRow = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2026 5월 운영 리포트",
  period: "this-month",
  periodStart: "2026-05-01",
  periodEnd: "2026-05-31",
  kpis: [
    {
      key: "service-open",
      label: "서비스 오픈",
      value: 32,
      prevValue: 31,
      delta: 1,
      deltaPct: 3.2,
      unit: "건",
      goodOnIncrease: true,
    },
  ],
  status: "completed",
  shareToken: null,
  createdBy: "ys1114@x.com",
  createdAt: "2026-05-31T10:00:00Z",
};

describe("renderReportPdf", () => {
  it("Buffer 반환 + 비어있지 않음", async () => {
    const buf = await renderReportPdf(sample);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000); // 최소 PDF 시그너처 + 메타
  }, 15000); // PDF 렌더는 폰트 로드로 다소 느림
});
