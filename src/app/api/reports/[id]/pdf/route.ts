import { NextResponse } from "next/server";
import { getReportById } from "@/features/reports/queries";
import { renderReportPdf } from "@/lib/pdf/report-pdf";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const report = await getReportById(id);
  if (!report) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const pdf = await renderReportPdf(report);
  // 파일명 — 제목에서 안전 문자만 추출
  const safeTitle = report.title.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "_").slice(0, 60);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
    },
  });
}
