"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ChecklistRound } from "@/features/checklist/schemas";
import { generateChecklistReport } from "@/features/checklist/report-actions";
import { ReportBody } from "@/components/checklist/ReportBody";

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
        <ReportBody html={round.reportHtml} />
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
