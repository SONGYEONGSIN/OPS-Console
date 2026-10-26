"use client";

import { useState, useTransition } from "react";
import { kstFormat } from "@/lib/kst-format";
import { refreshSmsSenderCache } from "@/features/sms-sender/actions";
import { CriteriaModal } from "./CriteriaModal";

const BUTTON_CLASS =
  "border border-line px-3 py-1 text-sm transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink";

const HHMM = kstFormat({ hour: "2-digit", minute: "2-digit" });

type Props = {
  fileName: string;
  fetchedAt: string;
  offRuleFiles: string[];
  unmatchedPdfs: string[];
  criteria: string[][] | null;
};

function Warning({ label, files }: { label: string; files: string[] }) {
  if (files.length === 0) return null;
  return (
    <details className="text-sm text-muted">
      <summary className="cursor-pointer">{label}</summary>
      <ul className="mt-1 pl-4">
        {files.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </details>
  );
}

/** 데이터 탭 공통 — 어느 파일을 몇 시에 읽었는지, 새로고침, 서류 기준. */
export function SourceBar({
  fileName,
  fetchedAt,
  offRuleFiles,
  unmatchedPdfs,
  criteria,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  const tail = fileName.match(/_\d{6}\.xlsm$/)?.[0] ?? fileName;
  const label = `현황 파일 ${tail} · 기준 ${HHMM.format(new Date(fetchedAt))}`;

  function refresh() {
    setError(null);
    startTransition(async () => {
      const result = await refreshSmsSenderCache();
      if (!result.ok) setError(result.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-7 pt-3">
      <span className="text-sm tabular-nums text-ink-soft">{label}</span>
      <button
        type="button"
        className={BUTTON_CLASS}
        disabled={pending}
        onClick={refresh}
      >
        새로고침
      </button>
      <button
        type="button"
        className={BUTTON_CLASS}
        disabled={criteria === null}
        title={
          criteria === null
            ? "05. 제출 서류 기준 시트를 찾지 못했습니다"
            : undefined
        }
        onClick={() => setShowCriteria(true)}
      >
        서류 기준
      </button>
      <Warning label={`규칙 밖 파일 ${offRuleFiles.length}개`} files={offRuleFiles} />
      <Warning
        label={`이름 미대조 PDF ${unmatchedPdfs.length}개`}
        files={unmatchedPdfs}
      />
      {error && (
        <span role="alert" className="text-sm text-vermilion">
          {error}
        </span>
      )}
      {showCriteria && criteria && (
        <CriteriaModal rows={criteria} onClose={() => setShowCriteria(false)} />
      )}
    </div>
  );
}

/** 현황 파일을 못 읽었을 때 — 빈 표 대신 이유를 보인다. */
export function SourceError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mx-7 mt-3 border border-line-soft bg-situation-bg p-4 text-sm"
    >
      <p>{message}</p>
      <p className="mt-1 text-muted">xlsm 헤더를 확인하거나 새로고침하세요.</p>
    </div>
  );
}
