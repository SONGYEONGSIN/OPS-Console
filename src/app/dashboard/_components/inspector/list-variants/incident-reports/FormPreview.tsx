"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import {
  deriveFormModel,
  type FormSource,
} from "@/features/incident-reports/form-content";

function rowToFormSource(row: ListRow): FormSource {
  return {
    recipientUniversity: row.incidentReportUniversity ?? "",
    title: row.incidentReportTitle ?? "",
    draftDate: row.incidentReportDraftDate ?? "",
    authorName: row.incidentReportAuthorName ?? "",
    approverName: row.incidentReportApproverName ?? null,
    directorName: row.incidentReportDirectorName ?? null,
    ceoName: row.incidentReportCeoName ?? null,
    docNumber: row.incidentReportDocNumber ?? null,
    apology: row.incidentReportApology ?? null,
    gyeongwi: row.incidentReportGyeongwi ?? null,
    cause: row.incidentReportCause ?? null,
    handling: row.incidentReportHandling ?? null,
    prevention: row.incidentReportPrevention ?? null,
  };
}

/** A4 한 장 — 흰 종이 느낌의 문서 면 */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] border border-line bg-cream px-10 py-12 text-sm leading-relaxed text-ink shadow-sm">
      {children}
    </div>
  );
}

export function FormPreview({ row }: { row: ListRow }) {
  const m = deriveFormModel(rowToFormSource(row));

  return (
    <div className="space-y-6">
      {/* ① 공문 */}
      <Sheet>
        <p className="mb-5 text-center text-2xs text-muted">{m.brandHeader}</p>
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p>제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
        <p className="mt-3">{m.greeting}</p>
        <p className="my-3 whitespace-pre-wrap">{m.apology}</p>
        <p>{m.attachment}</p>
        <p className="mt-6 font-bold">{m.companyLine}</p>
        <p className="text-2xs text-muted">전결 {m.jeonkyeolDate}</p>
        <div className="mt-3 flex border-y border-ink">
          {m.approvalLine.map((a, i) => (
            <div
              key={a.role}
              className={`flex-1 px-1 py-2 text-center text-2xs ${
                i < m.approvalLine.length - 1 ? "border-r border-line" : ""
              }`}
            >
              <div>{a.role}</div>
              <div className="mt-1">{a.name}</div>
            </div>
          ))}
        </div>
        {m.docNumber ? (
          <p className="mt-3 text-xs">시행&nbsp;&nbsp;{m.docNumber}</p>
        ) : null}
        <div className="mt-5 space-y-0.5 text-2xs text-muted">
          {m.contactLines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Sheet>

      {/* ② 경위서 본문 */}
      <Sheet>
        <p className="mb-5 text-center text-xl font-bold tracking-[0.5em]">
          경 위 서
        </p>
        <p>
          작 성 일 자 : {m.draftDate}&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;작 성 자
          : {m.authorName}
        </p>
        <p className="font-bold">제&nbsp;&nbsp;&nbsp;&nbsp;목 : {m.title}</p>
        <div className="mt-4 space-y-4">
          {m.sections.map((sec) => (
            <div key={sec.no}>
              <p className="font-bold">
                {sec.no}. {sec.label}
              </p>
              <p className="mt-1 whitespace-pre-wrap">{sec.body}</p>
            </div>
          ))}
        </div>
        <p className="mt-5 whitespace-pre-wrap">{m.closing}</p>
      </Sheet>
    </div>
  );
}
