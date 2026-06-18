"use client";

import Image from "next/image";
import {
  bodyLines,
  type FormModel,
} from "@/features/incident-reports/form-content";

/** 섹션 본문 — 줄 단위 렌더. '-' 세부 항목은 들여쓰기, 양쪽정렬 없이 자연 줄바꿈. */
function SectionBody({ body }: { body: string }) {
  return (
    <div className="mt-1 pl-3 leading-relaxed">
      {bodyLines(body).map((ln, i) => (
        <p key={i} className={`whitespace-pre-wrap ${ln.indent ? "pl-5" : ""}`}>
          {ln.text}
        </p>
      ))}
    </div>
  );
}

/** A4 종이 면 — 실제 공문 여백(위1·아래1·왼1.8·오른2 cm) 적용 */
function Sheet({
  children,
  fill = false,
}: {
  children: React.ReactNode;
  fill?: boolean;
}) {
  return (
    <div className="mx-auto w-full max-w-[210mm] bg-white shadow-sm">
      <div
        className={`flex flex-col pt-[10mm] pr-[20mm] pb-[10mm] pl-[18mm] text-sm leading-relaxed text-ink ${
          fill ? "min-h-[297mm]" : ""
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function CoverPage({ m }: { m: FormModel }) {
  return (
    <Sheet fill>
      <Image
        src="/brand/jinhakapply-logo-v2.png"
        alt="JINHAKapply"
        width={210}
        height={40}
        className="mx-auto"
        priority
      />
      <p className="mt-2 text-center text-2xs tracking-[0.22em] text-muted">
        {m.brandHeader}
      </p>
      <hr className="mt-1 border-ink" />

      {/* 라벨을 3글자 폭으로 통일(참→참　조, 제→제　목) → 값 시작 위치 정렬 */}
      <div className="mt-5 space-y-1">
        <p>
          수신자<span className="ml-5">{m.recipientUniversity}</span>
        </p>
        <p>참　조</p>
        <p className="font-bold">
          제　목<span className="ml-5">{m.title}</span>
        </p>
      </div>

      <hr className="mt-3 border-ink/50" />

      <ol className="mt-10 space-y-6 pl-7">
        {m.coverBody.map((line, i) => (
          <li key={i} className="flex gap-3">
            <span className="shrink-0">{i + 1}.</span>
            <span className="grow whitespace-pre-wrap text-justify leading-relaxed">
              {line}
            </span>
          </li>
        ))}
      </ol>

      <p className="mt-8 pl-7">붙임 : 1. {m.title} 경위서 1부</p>
      <p className="pl-7">끝.</p>

      {/* 세로 분산 — 공문이 A4 한 면을 꽉 채우도록 (직인 라인을 하단부로) */}
      <div className="grow" aria-hidden />

      {/* 회사명 + 직인(글자가 직인 위로 — 겹침) */}
      <div className="flex justify-center">
        <div className="relative inline-block">
          <Image
            src="/brand/incident-report-seal.png"
            alt="직인"
            width={84}
            height={84}
            className="absolute -right-9 top-1/2 -translate-y-1/2 opacity-90"
          />
          <p className="relative z-10 text-2xl font-bold tracking-wide">
            {m.companyLine}
          </p>
        </div>
      </div>

      {/* 회색 바 + 푸터 (전결/결재/시행·접수/연락처) — 직인 라인과 가깝게 */}
      {/* 일회성: 실제 공문 회색 구분 바 색 (토큰 line은 거의 검정이라 부적합) */}
      <div className="mt-12 h-2.5 w-full bg-[#cfc9bb]" aria-hidden />
      <p className="mt-3 text-right text-sm font-bold">
        전결 {m.jeonkyeolDate}
      </p>
      <div className="mt-3 flex w-full items-baseline justify-between text-sm">
        {m.approvalLine
          .filter((a) => a.name)
          .map((a) => (
            <span key={a.role} className="whitespace-nowrap">
              {a.role}&nbsp;&nbsp;{a.name}
            </span>
          ))}
      </div>
      <div className="mt-4 space-y-2 text-sm">
        {/* 시행은 왼쪽, 접수는 오른쪽 */}
        <div className="flex justify-between">
          <span>
            시 행&nbsp;&nbsp;
            {m.docNumber ? (
              `${m.docNumber} (${m.receiptDate})`
            ) : (
              <span className="text-muted">(자동 채번)</span>
            )}
          </span>
          <span>접 수 (&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;)</span>
        </div>
        {m.contactLines.map((line) => {
          // ㅣ 구분 구간을 양끝으로 분산(단어는 단일 공백 유지) — 한 줄 꽉 차게
          const segs = line.split("ㅣ").map((s) => s.trim());
          const items: { text: string; sep: boolean }[] = [];
          segs.forEach((seg, i) => {
            items.push({ text: seg, sep: false });
            if (i < segs.length - 1) items.push({ text: "ㅣ", sep: true });
          });
          return (
            <div
              key={line}
              className="flex w-full items-baseline justify-between tracking-[0.1em]"
            >
              {items.map((it, i) => (
                <span
                  key={i}
                  className={`whitespace-nowrap ${it.sep ? "text-muted" : ""}`}
                >
                  {it.text}
                </span>
              ))}
            </div>
          );
        })}
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
    <Sheet fill>
      <p className="mb-4 text-center text-3xl font-bold tracking-[0.5em]">
        경 위 서
      </p>
      <p className="mb-3 text-right text-sm font-bold">
        작 성 일 자 : {m.draftDate}
        <span className="ml-12">작 성 자 : {m.authorName}</span>
      </p>

      <div className="flex grow flex-col border border-ink">
        <p className="border-b border-dashed border-ink/60 px-4 py-2 font-bold">
          제&nbsp;&nbsp;&nbsp;&nbsp;목 : {m.title}
        </p>
        {/* 세로 밸런스 — 내용이 적든 많든 면을 고르게 채우도록 분산(justify-between) */}
        <div className="flex grow flex-col justify-between gap-4 px-5 pt-8 pb-4">
          {m.sections.map((sec) => (
            <div key={sec.no}>
              <p className="font-bold">
                {sec.no}. {sec.label}
              </p>
              {sec.rows && sec.rows.length > 0 ? (
                <HandlingTable rows={sec.rows} />
              ) : (
                <SectionBody body={sec.body} />
              )}
            </div>
          ))}
          <p className="whitespace-pre-wrap pt-2 leading-relaxed">
            {m.closing}
          </p>
        </div>
      </div>
    </Sheet>
  );
}

export function FormPage({ model, page }: { model: FormModel; page: number }) {
  return page === 1 ? <CoverPage m={model} /> : <ReportPage m={model} />;
}
