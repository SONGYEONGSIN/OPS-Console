"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

export type HeadlineUrgentRow = { time?: string; title: string };
export type HeadlineUrgentItem = {
  label: string;
  /** 큰 숫자 표시값(건수). valueText가 있으면 그쪽 우선. */
  count?: number;
  /** count 대신 표시할 문자열(예: "24 / 418"). */
  valueText?: string;
  href: string;
  rows?: HeadlineUrgentRow[];
};

type Props = {
  item: HeadlineUrgentItem;
  sub?: string;
  onClose: () => void;
};

/**
 * 헤드라인 긴급 항목 클릭 시 뜨는 요약 모달.
 * 즉시 페이지 이동 대신 요약(라벨·건수·sub)을 보여주고 "페이지 이동하기"로 이동.
 * Esc / 바깥 클릭 / 닫기 버튼으로 닫힘.
 */
export function HeadlineUrgentModal({ item, sub, onClose }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/40 p-4"
      onClick={(e) => {
        if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
          onClose();
        }
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${item.label} 요약`}
        className="w-full max-w-[360px] border-2 border-ink bg-paper shadow-offset"
      >
        <div className="flex items-center justify-between border-b border-line bg-ink px-4 py-2.5">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-cream">
            {item.label}
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기 (×)"
            className="cursor-pointer text-lg leading-none text-cream/70 hover:text-cream"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5">
          {item.valueText ? (
            <span className="text-3xl font-black tabular-nums text-vermilion">
              {item.valueText}
            </span>
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-black tabular-nums text-vermilion">
                {item.count ?? 0}
              </span>
              <span className="text-sm font-bold text-ink">건</span>
            </div>
          )}
          {sub && <p className="mt-2 text-sm text-muted">{sub}</p>}

          {item.rows && item.rows.length > 0 && (
            <ul className="mt-4 max-h-[280px] divide-y divide-line-soft overflow-y-auto border-y border-line">
              {item.rows.map((row, i) => (
                <li
                  key={`${row.title}-${i}`}
                  className="flex items-baseline gap-2.5 py-2 text-sm"
                >
                  {row.time && (
                    <span className="shrink-0 tabular-nums font-bold text-muted">
                      {row.time}
                    </span>
                  )}
                  <span className="text-ink-soft">{row.title}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="cursor-pointer px-3 py-2 text-sm font-medium text-muted hover:text-ink"
            >
              닫기
            </button>
            <Link
              href={item.href}
              className="bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-vermilion"
            >
              페이지 이동하기 →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
