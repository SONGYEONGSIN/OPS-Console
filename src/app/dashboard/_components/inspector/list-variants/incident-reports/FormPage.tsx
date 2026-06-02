"use client";

import Image from "next/image";
import type { FormModel } from "@/features/incident-reports/form-content";

/** A4 한 장 — 흰 종이 + 문서 테두리 프레임 (실제 공문 양식 재현) */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-cream p-6 shadow-sm">
      <div className="border border-ink/70 px-10 py-10 text-sm leading-relaxed text-ink">
        {children}
      </div>
    </div>
  );
}

/** 브랜드 로고 — 실제 로고 PNG가 public/brand/jinhakapply-logo.png 로 들어오면 교체.
 *  현재는 워드마크 텍스트로 자리만 잡는다. */
function BrandMark() {
  return (
    <p className="mb-2 text-center text-2xl font-extrabold tracking-tight text-ink">
      JINHAK<span className="text-vermilion">apply</span>
      <span aria-hidden className="text-vermilion">
        {" "}
        ▸
      </span>
    </p>
  );
}

function CoverPage({ m }: { m: FormModel }) {
  return (
    <Sheet>
      <BrandMark />
      <p className="border-y border-ink/60 py-1.5 text-center text-2xs text-muted">
        {m.brandHeader}
      </p>

      <div className="mt-4 space-y-0.5">
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p>제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
      </div>

      <hr className="my-3 border-ink/40" />

      <p className="whitespace-pre-wrap">{m.apology}</p>
      <p className="mt-4">{m.attachment}</p>

      {/* 회사명 + 직인(겹침) */}
      <div className="relative mt-10 flex items-center justify-center">
        <p className="text-xl font-bold tracking-wide">{m.companyLine}</p>
        <Image
          src="/brand/incident-report-seal.png"
          alt="직인"
          width={64}
          height={64}
          className="absolute right-16 -top-2 opacity-90"
        />
      </div>

      {/* 회색 바 */}
      <div className="mt-8 h-2 w-full bg-line" aria-hidden />

      {/* 전결 + 결재 한 줄 */}
      <p className="mt-3 text-right text-2xs text-muted">
        전결 {m.jeonkyeolDate}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
        {m.approvalLine
          .filter((a) => a.name)
          .map((a) => (
            <span key={a.role}>
              <span className="text-muted">{a.role}</span>&nbsp;&nbsp;{a.name}
            </span>
          ))}
      </div>

      <p className="mt-3">
        시 행&nbsp;&nbsp;{m.docNumber ?? ""}
        <span className="ml-8 text-muted">접 수 (&nbsp;&nbsp;&nbsp;&nbsp;)</span>
      </p>

      <div className="mt-2 space-y-0.5 text-2xs text-muted">
        {m.contactLines.map((line) => (
          <p key={line}>{line}</p>
        ))}
      </div>
    </Sheet>
  );
}

/** 3.처리 시간/내용 2열 표 */
function HandlingTable({
  rows,
}: {
  rows: readonly { time: string; content: string }[];
}) {
  return (
    <table className="mt-1 w-full border-collapse text-sm">
      <thead>
        <tr>
          <th className="w-40 border border-ink/50 bg-washi-raised px-2 py-1 text-center font-medium">
            시간
          </th>
          <th className="border border-ink/50 bg-washi-raised px-2 py-1 text-center font-medium">
            내용
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.time}-${i}`}>
            <td className="border border-ink/50 px-2 py-1 align-top whitespace-pre-wrap">
              {r.time}
            </td>
            <td className="border border-ink/50 px-2 py-1 align-top whitespace-pre-wrap">
              {r.content}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ReportPage({ m }: { m: FormModel }) {
  return (
    <Sheet>
      <p className="mb-4 text-center text-2xl font-bold tracking-[0.5em]">
        경 위 서
      </p>
      <p className="mb-3 text-center text-sm">
        작 성 일 자 : {m.draftDate}
        <span className="ml-10">작 성 자 : {m.authorName}</span>
      </p>

      <div className="border border-ink/70">
        <p className="border-b border-ink/50 px-4 py-2 font-bold">
          제&nbsp;&nbsp;&nbsp;&nbsp;목 : {m.title}
        </p>
        <div className="space-y-4 px-4 py-4">
          {m.sections.map((sec) => (
            <div key={sec.no}>
              <p className="font-bold">
                {sec.no}. {sec.label}
              </p>
              {sec.rows && sec.rows.length > 0 ? (
                <HandlingTable rows={sec.rows} />
              ) : (
                <p className="mt-1 whitespace-pre-wrap">{sec.body}</p>
              )}
            </div>
          ))}
          <p className="whitespace-pre-wrap pt-2">{m.closing}</p>
        </div>
      </div>
    </Sheet>
  );
}

export function FormPage({ model, page }: { model: FormModel; page: number }) {
  return page === 1 ? <CoverPage m={model} /> : <ReportPage m={model} />;
}
