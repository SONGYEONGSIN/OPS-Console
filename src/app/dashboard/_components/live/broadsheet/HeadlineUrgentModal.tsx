"use client";

import Link from "next/link";
import { ModalShell } from "@/components/common/ModalShell";

export type HeadlineUrgentRow = { time?: string; title: string; sub?: string };
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
 * 헤드라인/지표 항목 클릭 시 뜨는 요약 모달. 표준 ModalShell 사용.
 * 요약(건수/값 + sub + 상세 리스트) + "페이지 이동하기".
 */
export function HeadlineUrgentModal({ item, sub, onClose }: Props) {
  return (
    <ModalShell
      title={item.label}
      onClose={onClose}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink hover:bg-washi"
          >
            닫기
          </button>
          <Link
            href={item.href}
            className="border border-ink bg-ink px-4 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion"
          >
            페이지 이동하기 →
          </Link>
        </>
      }
    >
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
        <ul className="mt-4 max-h-[460px] divide-y divide-line-soft overflow-y-auto border-y border-line">
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
              <div className="flex min-w-0 flex-col">
                <span className="text-ink-soft">{row.title}</span>
                {row.sub && (
                  <span className="mt-0.5 text-xs text-muted">{row.sub}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  );
}
