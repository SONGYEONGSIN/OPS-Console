"use client";

import type { ListRow } from "../patterns/ListPattern";
import { STATUS_LABEL, STATUS_RING } from "./list-variants/status";

type Props = {
  row: ListRow;
  editing: boolean;
  onToggleEdit: () => void;
  /** false면 편집 토글 버튼 hide (viewer / read-only context). 기본 true */
  editable?: boolean;
  children: React.ReactNode;
};

/**
 * 인스펙터 슬라이드인 패널의 공통 chrome.
 * - 상단 label / title / id+meta / status 뱃지
 * - "구성 편집" ↔ "읽기 모드" 토글
 * - 아래 children으로 variant 본문 (View 또는 EditForm)
 */
export function InspectorChrome({
  row,
  editing,
  onToggleEdit,
  editable = true,
  children,
}: Props) {
  return (
    <>
      <header className="mb-6 border-b-2 border-ink pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <p className="text-2xs uppercase tracking-[0.18em] text-vermilion">
              인스펙터 · 항목 상세
            </p>
            <h3 className="text-xl font-bold tracking-[-0.01em] text-ink">
              {row.name}
            </h3>
            <p className="text-xs text-muted">
              <span className="font-mono">{row.id.toUpperCase()}</span>
              {row.meta && <> · {row.meta}</>}
              <> · PROD</>
            </p>
          </div>
          <div
            aria-hidden
            className={`flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-full text-[10px] leading-tight text-cream ${
              STATUS_RING[row.status]
            }`}
          >
            <span className="text-base">★</span>
            <span>{STATUS_LABEL[row.status]}</span>
          </div>
        </div>
        {editable && (
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={onToggleEdit}
              className="cursor-pointer text-xs font-medium text-vermilion underline hover:text-vermilion-deep border-none bg-transparent p-0"
            >
              {editing ? "읽기 모드" : "구성 편집"}
            </button>
          </div>
        )}
      </header>
      {children}
    </>
  );
}
