"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";
import type { Variant } from "../inspector/list-variants/types";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { LivePageHeader } from "./LivePageHeader";
import { LiveCard } from "./LiveCard";
import type { SimpleColumn, SimpleRow } from "./SimpleTable";

export type LiveCardConfig = {
  label: string;
  count: number | null;
  /** mine 모드 보조 라벨 (예: '내 담당') */
  countSub?: string;
  variant: Variant;
  /** mini-table 컬럼 정의 */
  columns: SimpleColumn[];
  /** mini-table용 단순 row (id + 표시 컬럼만) */
  simpleRows: SimpleRow[];
  /** id → 인스펙터용 전체 ListRow 매핑 */
  listRowsById: Record<string, ListRow>;
};

type Props = {
  mine: boolean;
  cards: LiveCardConfig[];
  /** placeholder 슬롯 채울 총 개수 (보통 9 = 3-column × 3-row) */
  totalSlots?: number;
};

/**
 * LiveDashboard — 3-column 고정 그리드 + 도메인 카드들 + 우측 인스펙터.
 * row 클릭 → variant + listRow를 selected state로 보관 → InspectorPanel slide-in.
 */
export function LiveDashboard({ mine, cards, totalSlots = 9 }: Props) {
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);

  const padded = [...cards];
  while (padded.length < totalSlots) padded.push(null as never);

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title="실시간 현황" />
      <div className="flex-1 overflow-y-auto bg-washi-raised px-6 py-6">
        <div className="mx-auto max-w-[1400px]">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {padded.map((card, i) => {
              if (!card) {
                return <LiveCard key={`placeholder-${i}`} placeholder />;
              }
              const selectedIdHere =
                selected?.variant === card.variant ? selected.row.id : null;
              return (
                <LiveCard
                  key={card.variant}
                  label={card.label}
                  count={card.count}
                  countSub={card.countSub}
                  columns={card.columns}
                  rows={card.simpleRows}
                  selectedId={selectedIdHere}
                  onRowClick={(id) => {
                    const row = card.listRowsById[id];
                    if (row) setSelected({ variant: card.variant, row });
                  }}
                />
              );
            })}
          </section>
        </div>
      </div>

      <InspectorPanel open={!!selected} onClose={() => setSelected(null)}>
        {selected ? (
          <InspectorChrome
            row={selected.row}
            editing={false}
            onToggleEdit={() => {}}
            editable={false}
          >
            <InspectorListBody
              row={selected.row}
              editing={false}
              onSave={() => {}}
              onCancel={() => {}}
              variant={selected.variant}
            />
          </InspectorChrome>
        ) : null}
      </InspectorPanel>
    </div>
  );
}
