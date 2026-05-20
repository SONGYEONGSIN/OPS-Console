"use client";

import { SimpleTable, type SimpleColumn, type SimpleRow } from "./SimpleTable";

type ContentProps = {
  label: string;
  count: number | null;
  /** mine 모드 보조 라벨 (예: '내 담당') — 카운트 옆 노출 */
  countSub?: string;
  columns: SimpleColumn[];
  rows: SimpleRow[];
  selectedId?: string | null;
  onRowClick: (id: string) => void;
};

type PlaceholderProps = {
  placeholder: true;
};

type Props = (ContentProps & { placeholder?: false }) | PlaceholderProps;

/**
 * LiveCard — 실시간 현황 한 도메인 카드.
 * 헤더(label + count + countSub) + SimpleTable(최근 5건, list-variant Table 톤 통일).
 * placeholder=true 면 "도메인 추가 자리" 표시.
 */
export function LiveCard(props: Props) {
  if ("placeholder" in props && props.placeholder) {
    return (
      <article className="flex h-full min-h-[180px] flex-col items-center justify-center border border-dashed border-line bg-cream/50 p-4 text-xs text-muted">
        + 도메인 추가 자리
      </article>
    );
  }

  const { label, count, countSub, columns, rows, selectedId, onRowClick } =
    props as ContentProps;

  return (
    <article className="flex flex-col bg-cream">
      <header className="flex items-baseline justify-between border-b-2 border-ink px-1 pb-2">
        <h3 className="text-sm font-semibold tracking-[-0.01em] text-ink">
          {label}
        </h3>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-base font-bold text-ink">
            {count == null ? "—" : count.toLocaleString("ko-KR")}
          </span>
          {countSub ? (
            <span className="text-2xs text-muted">{countSub}</span>
          ) : null}
        </div>
      </header>
      <div className="flex-1 overflow-x-auto">
        <SimpleTable
          columns={columns}
          rows={rows}
          selectedId={selectedId}
          onRowClick={onRowClick}
        />
      </div>
    </article>
  );
}
