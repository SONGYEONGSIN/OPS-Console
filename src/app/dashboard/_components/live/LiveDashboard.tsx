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

export type LiveGroupConfig = {
  /** 그룹 라벨 (예: "요청·자료" / "서비스 사이클" / "개인·활동") */
  label: string;
  /** 그룹 보조 설명 */
  description?: string;
  cards: LiveCardConfig[];
  /** 그룹 내 한 row 슬롯 수 (기본 3) */
  slotsPerRow?: number;
};

type Props = {
  mine: boolean;
  /** 영역 그룹 위 최상단 요약 슬롯 (Hero + StatTile 등) */
  summary?: React.ReactNode;
  groups: LiveGroupConfig[];
};

/**
 * LiveDashboard — 영역(그룹)별 카드 그리드 + 우측 인스펙터.
 * 각 그룹은 라벨 + 3-column 카드 row. row 클릭 → InspectorPanel slide-in.
 */
export function LiveDashboard({ mine, summary, groups }: Props) {
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title="실시간 현황" />
      <div
        className={`flex-1 overflow-y-auto bg-cream px-6 py-6 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          selected ? "md:pr-[400px]" : ""
        }`}
      >
        <div className="mx-auto max-w-[1400px] space-y-8">
          {summary ? <section>{summary}</section> : null}
          {groups.map((group) => {
            const slots = group.slotsPerRow ?? 3;
            const padded: (LiveCardConfig | null)[] = [...group.cards];
            while (padded.length % slots !== 0) padded.push(null);
            return (
              <section key={group.label}>
                <header className="mb-3 flex items-baseline gap-3 border-b border-line-soft pb-2">
                  <span className="font-mono text-2xs uppercase tracking-[0.22em] text-vermilion">
                    {group.label}
                  </span>
                  {group.description ? (
                    <span className="text-xs text-muted">
                      · {group.description}
                    </span>
                  ) : null}
                </header>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {padded.map((card, i) => {
                    if (!card) {
                      return (
                        <LiveCard
                          key={`${group.label}-placeholder-${i}`}
                          placeholder
                        />
                      );
                    }
                    const selectedIdHere =
                      selected?.variant === card.variant
                        ? selected.row.id
                        : null;
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
                </div>
              </section>
            );
          })}
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
