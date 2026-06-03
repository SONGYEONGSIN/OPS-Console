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

function CoverPage({ m }: { m: FormModel }) {
  return (
    <Sheet>
      <Image
        src="/brand/jinhakapply-logo.png"
        alt="JINHAKapply"
        width={200}
        height={39}
        className="mx-auto"
        priority
      />
      <p className="mt-2 text-center text-2xs text-muted">{m.brandHeader}</p>
      <hr className="mt-1 border-ink" />

      <div className="mt-5 space-y-0.5">
        <p>수신자&nbsp;&nbsp;{m.recipientUniversity}</p>
        <p>참&nbsp;&nbsp;조</p>
        <p className="font-bold">제&nbsp;&nbsp;목&nbsp;&nbsp;{m.title}</p>
      </div>

      <hr className="my-3 border-ink/50" />

      <ol className="space-y-6 pl-7">
        {m.coverBody.map((line, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0">{i + 1}.</span>
            <span className="whitespace-pre-wrap leading-relaxed">{line}</span>
          </li>
        ))}
      </ol>

      <p className="mt-8">붙임 : 1. {m.title} 경위서 1부</p>
      <p>끝.</p>

      {/* 회사명 + 직인(글자가 직인 위로 — 직인 뒤, 겹침) */}
      <div className="mt-16 flex justify-center">
        <div className="relative inline-block">
          <Image
            src="/brand/incident-report-seal.png"
            alt="직인"
            width={64}
            height={64}
            className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-90"
          />
          <p className="relative z-10 text-2xl font-bold tracking-wide">
            {m.companyLine}
          </p>
        </div>
      </div>

      {/* 회색 바 + 푸터 (전결/결재/시행/연락처) */}
      {/* 일회성: 실제 공문 회색 구분 바 색 (토큰 line은 거의 검정이라 부적합) */}
      <div className="mt-20 h-2.5 w-full bg-[#cfc9bb]" aria-hidden />
      <p className="mt-1.5 text-right text-sm font-bold">
        전결 {m.jeonkyeolDate}
      </p>
      <div className="flex flex-wrap items-baseline gap-x-16 gap-y-1 text-sm">
        {m.approvalLine
          .filter((a) => a.name)
          .map((a) => (
            <span key={a.role}>
              {a.role}&nbsp;&nbsp;{a.name}
            </span>
          ))}
      </div>
      <div className="mt-1 space-y-1 text-sm">
        <p>
          시 행&nbsp;&nbsp;{m.docNumber ?? ""}
          <span className="ml-16">접 수 (&nbsp;&nbsp;&nbsp;&nbsp;)</span>
        </p>
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
      <p className="mb-3 text-right text-sm font-bold">
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
