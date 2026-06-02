import { NextResponse } from "next/server";
import { getIncidentReport } from "@/features/incident-reports/queries";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import type { IncidentReportRow } from "@/features/incident-reports/schemas";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rep = (await getIncidentReport(id)) as IncidentReportRow | null;
  if (!rep) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const pdf = await renderIncidentReportPdf({
    recipientUniversity: rep.recipient_university,
    title: rep.title,
    draftDate: rep.draft_date,
    authorName: rep.author_name,
    authorEmail: rep.author_email,
    approverName: rep.approver_name,
    directorName: rep.director_name,
    ceoName: rep.ceo_name,
    docNumber: rep.doc_number,
    apology: rep.apology ?? "",
    gyeongwi: rep.gyeongwi,
    cause: rep.cause,
    handling: rep.handling,
    handlingRows: rep.handling_rows,
    prevention: rep.prevention,
  });
  // 파일명 — 제목에서 안전 문자만 추출
  const safeTitle = rep.title.replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ-]/g, "_").slice(0, 60);
  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(safeTitle)}.pdf`,
    },
  });
}
