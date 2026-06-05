import { NextResponse } from "next/server";
import {
  getIncidentReport,
  resolveApprovalChain,
} from "@/features/incident-reports/queries";
import { getIncidentById } from "@/features/incidents/queries";
import { previewNextDocNumber } from "@/features/incident-reports/sharepoint-register";
import { renderIncidentReportPdf } from "@/lib/pdf/incident-report-pdf";
import {
  isReportLiveMirrored,
  type IncidentReportRow,
} from "@/features/incident-reports/schemas";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const rep = (await getIncidentReport(id)) as IncidentReportRow | null;
  if (!rep) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // 발송 전이면 예상 시행번호를 미리보기로 표시(확정은 발송 시).
  const docNumber =
    rep.doc_number ??
    (await previewNextDocNumber(new Date()).catch(() => null));
  // 편집 화면과 동일하게 — 담당자/대학명/결재체인을 연결된 사고 기준으로 보강.
  const incident = rep.incident_id
    ? await getIncidentById(rep.incident_id).catch(() => null)
    : null;
  const chain = await resolveApprovalChain(
    incident?.assignee_email ?? rep.author_email,
  ).catch(() => null);
  // 편집 화면과 동일 — 작성중(draft/rejected)이면 공유 필드를 연결 사고의 현재값으로
  // 라이브 미러, 승인 이후는 동결 스냅샷(rep 값)을 사용한다.
  const liveMirror = isReportLiveMirrored(rep.status);
  const live =
    liveMirror && incident
      ? {
          recipientUniversity:
            incident.university_name ?? rep.recipient_university,
          title: incident.title ?? rep.title,
          gyeongwi: incident.cause_summary ?? rep.gyeongwi,
          cause: incident.root_cause ?? rep.cause,
          handling: incident.resolution ?? rep.handling,
          handlingRows: incident.handling_rows?.length
            ? incident.handling_rows
            : rep.handling_rows,
          prevention: incident.prevention ?? rep.prevention,
        }
      : null;
  const pdf = await renderIncidentReportPdf({
    recipientUniversity: live?.recipientUniversity ?? rep.recipient_university,
    title: live?.title ?? rep.title,
    draftDate: rep.draft_date,
    authorName: incident?.assignee_name ?? rep.author_name,
    authorEmail: incident?.assignee_email ?? rep.author_email,
    authorPhone: chain?.author?.phone ?? null,
    approverName: rep.approver_name ?? chain?.approver?.name ?? null,
    approverRole: rep.approver_role ?? chain?.approver?.role ?? null,
    directorName: rep.director_name ?? chain?.director?.name ?? null,
    directorRole: rep.director_role ?? chain?.director?.role ?? null,
    ceoName: rep.ceo_name ?? chain?.ceo?.name ?? null,
    ceoRole: rep.ceo_role ?? chain?.ceo?.role ?? null,
    docNumber,
    apology: rep.apology ?? "",
    gyeongwi: live?.gyeongwi ?? rep.gyeongwi,
    cause: live?.cause ?? rep.cause,
    handling: live?.handling ?? rep.handling,
    handlingRows: live?.handlingRows ?? rep.handling_rows,
    prevention: live?.prevention ?? rep.prevention,
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
