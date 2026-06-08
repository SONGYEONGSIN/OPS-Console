"use client";

import { useState, useTransition } from "react";
import { issueIncidentReportDocNumber } from "@/features/incident-reports/actions";

/**
 * PDF 버튼 — 클릭 시 발번(승인완료 + 미발번이면 1회만)을 먼저 수행한 뒤 PDF를 연다.
 *
 * 발번 = 시행번호 채번 + 공문관리대장 행 기록(F 링크는 발송 시 채움). 멱등(이미 발번 시 재사용).
 * GET PDF route가 발번 후 rep.doc_number를 표기하므로, 발번을 끝내고 새 탭으로 연다.
 */
export function PdfButton({ reportId }: { reportId: string }) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function handleClick() {
    if (busy || pending) return;
    setBusy(true);
    startTransition(async () => {
      try {
        await issueIncidentReportDocNumber(reportId);
      } catch {
        // 발번 실패해도 PDF 미리보기는 열어준다(번호는 예상값으로 표기).
      } finally {
        window.open(
          `/api/incident-reports/${reportId}/pdf`,
          "_blank",
          "noopener,noreferrer",
        );
        setBusy(false);
      }
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy || pending}
      className="cursor-pointer border border-vermilion bg-transparent px-3 py-1 text-sm font-medium text-vermilion transition-colors hover:bg-vermilion hover:text-cream disabled:cursor-not-allowed disabled:opacity-60"
    >
      {busy || pending ? "발번 중…" : "PDF"}
    </button>
  );
}
