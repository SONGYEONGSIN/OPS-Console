"use client";

import Image from "next/image";
import type { FormModel } from "@/features/incident-reports/form-content";

/** A4 한 장 — 흰 종이 면 (공문은 무테두리, 경위서 본문만 내부 프레임) */
function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-cream px-12 py-12 text-sm leading-relaxed text-ink shadow-sm">
      {children}
    </div>
  );
}

/** JINHAKapply 브랜드 로고 근사 — 실제 로고 PNG(public/brand/jinhakapply-logo.png) 수령 시 교체. */
function BrandMark() {
  return (
    <p className="mb-1 text-center text-3xl font-extrabold tracking-tight">
      {/* 일회성: JINHAKapply 브랜드 컬러 직접 매칭 (로고 PNG 미수령, 토큰화 대상 아님) */}
      <span className="text-[#15306b]">JINHAK</span>
      <span className="text-[#2e6fc4]">apply</span>
      <span className="ml-0.5 text-[#f5a623]">›</span>
    </p>
  );
}

function CoverPage({ m }: { m: FormModel }) {
  return (
    <Sheet>
      <BrandMark />
      <hr className="mt-1 border-ink" />

      <div className="mt-5 space-y-0.5">
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p className="font-bold">제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
      </div>

      <hr className="my-3 border-ink/50" />

      <ol className="space-y-2 pl-2">
        {m.coverBody.map((line, i) => (
          <li key={i} className="flex gap-2">
            <span className="shrink-0">{i + 1}.</span>
            <span className="whitespace-pre-wrap">{line}</span>
          </li>
        ))}
      </ol>

      <p className="mt-5">붙임 : 1. {m.title} 경위서 1부</p>
      <p>끝.</p>

      {/* 회사명 + 직인(겹침) */}
      <div className="relative mt-12 flex items-center justify-center">
        <p className="text-2xl font-bold tracking-wide">{m.companyLine}</p>
        <Image
          src="/brand/incident-report-seal.png"
          alt="직인"
          width={64}
          height={64}
          className="absolute right-24 -top-3 opacity-90"
        />
      </div>

      {/* 회색 바 */}
      <div className="mt-12 h-2 w-full bg-line" aria-hidden />

      <p className="mt-1 text-right text-2xs font-bold">
        전결 {m.jeonkyeolDate}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-8 gap-y-1 text-sm">
        {m.approvalLine
          .filter((a) => a.name)
          .map((a) => (
            <span key={a.role}>
              {a.role}&nbsp;&nbsp;{a.name}
            </span>
          ))}
      </div>

      <p className="mt-1">
        시 행&nbsp;&nbsp;{m.docNumber ?? ""}
        <span className="ml-10">접 수 (&nbsp;&nbsp;&nbsp;&nbsp;)</span>
      </p>

      <div className="mt-1 space-y-0.5 text-2xs">
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
          <th className="w-40 border border-ink/60 bg-washi-raised px-2 py-1 text-center font-medium">
            일시
          </th>
          <th className="border border-ink/60 bg-washi-raised px-2 py-1 text-center font-medium">
            내용
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={`${r.time}-${i}`}>
            <td className="border border-ink/60 px-2 py-1 text-center align-top whitespace-pre-wrap">
              {r.time}
            </td>
            <td className="border border-ink/60 px-2 py-1 align-top whitespace-pre-wrap">
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
      <p className="mb-4 text-center text-3xl font-bold tracking-[0.5em]">
        경 위 서
      </p>
      <p className="mb-3 text-center text-sm font-bold">
        작 성 일 자 : {m.draftDate}
        <span className="ml-12">작 성 자 : {m.authorName}</span>
      </p>

      <div className="border border-ink">
        <p className="border-b border-dashed border-ink/60 px-4 py-2 font-bold">
          제&nbsp;&nbsp;&nbsp;&nbsp;목 : {m.title}
        </p>
        <div className="space-y-4 px-5 py-4">
          {m.sections.map((sec) => (
            <div key={sec.no}>
              <p className="font-bold">
                {sec.no}. {sec.label}
              </p>
              {sec.rows && sec.rows.length > 0 ? (
                <HandlingTable rows={sec.rows} />
              ) : (
                <p className="mt-1 whitespace-pre-wrap pl-3">{sec.body}</p>
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
