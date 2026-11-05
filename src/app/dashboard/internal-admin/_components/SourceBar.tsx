"use client";

import { useState, useTransition } from "react";
import { kstFormat } from "@/lib/kst-format";
import { refreshSmsSenderCache } from "@/features/sms-sender/actions";
import { CriteriaModal } from "./CriteriaModal";

/**
 * 표 머리 오른쪽 보조 버튼 — 헤더 액션(`HeaderActionButton`)과 같은 치수에 테두리만.
 * vermilion 은 '새로 만들기' 같은 주 액션 자리라 여기 쓰지 않는다(서비스목록의
 * 발표 서비스 담당자 맞추기 버튼과 같은 모양).
 */
const BUTTON_CLASS =
  "cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink";

const HHMM = kstFormat({ hour: "2-digit", minute: "2-digit" });

export type SourceInfo = {
  fileName: string;
  fetchedAt: string;
  criteria: string[][] | null;
};

/**
 * 목록 머리 오른쪽 — 어느 파일을 몇 시에 읽었는지, 새로고침, 서류 기준.
 * 예전엔 표 위 검색줄 자리를 통째로 차지했다.
 */
export function SourceBar({ fileName, fetchedAt, criteria }: SourceInfo) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [showCriteria, setShowCriteria] = useState(false);

  const tail = fileName.match(/_\d{6}\.xlsm$/)?.[0] ?? fileName;
  const label = `현황 파일 ${tail} · 기준 ${HHMM.format(new Date(fetchedAt))}`;

  function refresh() {
    setError(null);
    startTransition(async () => {
      // 던진 채로 두면 React 19 가 오류 경계로 올려 페이지 전체가 오류 화면이 된다.
      try {
        const result = await refreshSmsSenderCache();
        if (!result.ok) setError(result.error);
      } catch {
        setError("새로고침에 실패했습니다. 잠시 뒤 다시 시도하세요.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs tabular-nums text-ink-soft">{label}</span>
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
      {error && (
        <span role="alert" className="text-xs text-vermilion">
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
