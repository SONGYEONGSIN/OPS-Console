"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistRound } from "@/features/checklist/schemas";
import { generateChecklistReport } from "@/features/checklist/report-actions";

// 서술형 보고 문서 스타일 — 제목/문단/표/목록. 정화된 HTML을 문서처럼 렌더.
// 임원 보고용 개조식 아웃라인 — 최상위 불릿 '–', 하위 불릿 '·'. 표는 테두리.
const REPORT_CLASS =
  "[&>*:first-child]:mt-0 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:border-b [&_h2]:border-line [&_h2]:pb-1 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-ink [&_h3]:mb-1 [&_h3]:mt-3 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-ink [&_p]:my-2 [&_p]:text-sm [&_p]:leading-relaxed [&_p]:text-ink [&_ul]:my-1.5 [&_ul]:list-none [&_ul]:pl-4 [&_ul_ul]:my-1 [&_li]:relative [&_li]:my-1 [&_li]:pl-4 [&_li]:text-sm [&_li]:leading-relaxed [&_li]:text-ink [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:text-muted [&_li]:before:content-['–'] [&_ul_ul_li]:before:content-['·'] [&_b]:font-semibold [&_table]:my-3 [&_table]:border-collapse [&_table]:text-sm [&_th]:border [&_th]:border-line [&_th]:bg-line-soft [&_th]:px-2 [&_th]:py-1 [&_th]:font-semibold [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1";

function formatKST(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * 관리자 보고리포트 문서 — 저장된 AI 리포트(HTML)를 문서로 렌더 + 생성/재생성 버튼.
 * 생성은 서버 액션(claude -p, 로컬 CLI 필요). 완료 후 router.refresh로 갱신.
 */
export function ReportDocument({ round }: { round: ChecklistRound }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const run = () => {
    setError(null);
    start(async () => {
      const res = await generateChecklistReport(round.id);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  };

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <p className="text-xs text-muted">
          {round.reportGeneratedAt
            ? `생성 ${formatKST(round.reportGeneratedAt)}`
            : ""}
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "생성 중…" : round.reportHtml ? "재생성" : "리포트 생성"}
          </button>
          {pending ? (
            <span className="text-xs text-muted">
              작성 내용을 정리하는 중입니다 (수십 초 소요)
            </span>
          ) : null}
          {error ? (
            <span className="max-w-xs text-right text-xs text-vermilion">
              {error}
            </span>
          ) : null}
        </div>
      </div>

      {round.reportHtml ? (
        <article
          className={REPORT_CLASS}
          dangerouslySetInnerHTML={{ __html: round.reportHtml }}
        />
      ) : (
        <div className="border border-line-soft bg-situation-bg p-10 text-center text-sm leading-relaxed text-muted">
          아직 생성된 보고리포트가 없습니다.
          <br />
          &lsquo;리포트 생성&rsquo;을 누르면 작성된 전체 내용을 정리해 보고
          문서를 만듭니다.
        </div>
      )}
    </div>
  );
}
