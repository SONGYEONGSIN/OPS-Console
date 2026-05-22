"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { LivePageHeader } from "./LivePageHeader";
import { KpiTile } from "./KpiTile";
import { FeedChips, type FeedFilter } from "./FeedChips";
import { FeedRow } from "./FeedRow";
import type { FeedItem, FeedDomain } from "./feed";

export type KpiTileConfig = {
  variant: Variant;
  label: string;
  count: number | null;
  countSub: string;
  href: string;
};

type Props = {
  mine: boolean;
  tiles: KpiTileConfig[];
  feedItems: FeedItem[];
};

export function LiveOverview({ mine, tiles, feedItems }: Props) {
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [selected, setSelected] = useState<{ variant: Variant; row: ListRow } | null>(null);

  const counts = useMemo(() => {
    const c: Record<"all" | FeedDomain, number> = {
      all: feedItems.length,
      incidents: 0,
      todos: 0,
      services: 0,
      schedule: 0,
      backup: 0,
    };
    for (const it of feedItems) c[it.domain] += 1;
    return c;
  }, [feedItems]);

  const visible = useMemo(
    () => (filter === "all" ? feedItems : feedItems.filter((x) => x.domain === filter)),
    [filter, feedItems],
  );

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title="실시간 현황" />
      <div
        className={`flex-1 overflow-y-auto bg-cream px-6 py-6 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          selected ? "md:pr-[400px]" : ""
        }`}
      >
        <div className="mx-auto max-w-[1400px] space-y-6">
          <section
            aria-label="KPI 타일"
            className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
          >
            {tiles.map((t) => (
              <KpiTile
                key={t.variant + t.label}
                label={t.label}
                count={t.count}
                countSub={t.countSub}
                href={t.href}
              />
            ))}
          </section>
          <FeedChips active={filter} counts={counts} onChange={setFilter} />
          <section aria-label="우선순위 피드" className="border-t border-line">
            {visible.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted">
                예정된 항목이 없습니다.
              </p>
            ) : (
              visible.map((it) => (
                <FeedRow
                  key={it.id}
                  item={it}
                  onSelect={(item) =>
                    setSelected({ variant: item.variant, row: item.listRow })
                  }
                />
              ))
            )}
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
