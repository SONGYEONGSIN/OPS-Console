"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { LivePageHeader } from "./LivePageHeader";
import { KpiCardLarge } from "./KpiCardLarge";
import { Sparkline } from "./Sparkline";
import { KpiProgressBar } from "./KpiProgressBar";
import { MetricGroupBox } from "./MetricGroupBox";
import { MetricSubcard } from "./MetricSubcard";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
import type { LiveTableItem } from "./live-table-builder";

export type LiveOverviewProps = {
  mine: boolean;
  title: string;
  kpi: {
    sago: { count: number; sparklineD: string };
    todo: { count: number; done: number; total: number };
    service: { count: number; sparklineD: string };
  };
  metrics: {
    contract: { value: number | string; active?: boolean; desc: string };
    bond: { value: number | string; active?: boolean; desc: string };
    backup: { value: number | string; desc: string };
    contacts: { value: number | string; desc: string };
    scheduleActivity: { value: string; desc: string };
  };
  tableItems: LiveTableItem[];
};

export function LiveOverview({
  mine,
  title,
  kpi,
  metrics,
  tableItems,
}: LiveOverviewProps) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);

  const counts = useMemo(() => {
    const c: Record<LiveFilter, number> = {
      all: tableItems.length,
      incidents: 0,
      todos: 0,
      services: 0,
      backup: 0,
    };
    for (const it of tableItems) {
      if (it.domain === "incidents") c.incidents += 1;
      else if (it.domain === "todos") c.todos += 1;
      else if (it.domain === "services") c.services += 1;
      else if (it.domain === "backup" || it.domain === "schedule") c.backup += 1;
    }
    return c;
  }, [tableItems]);

  const visible = useMemo(() => {
    if (filter === "all") return tableItems;
    if (filter === "backup")
      return tableItems.filter(
        (x) => x.domain === "backup" || x.domain === "schedule",
      );
    return tableItems.filter((x) => x.domain === filter);
  }, [filter, tableItems]);

  const todoPct =
    kpi.todo.total > 0
      ? Math.round((kpi.todo.done / kpi.todo.total) * 100)
      : 0;

  return (
    <div className="flex h-full flex-col">
      <LivePageHeader mine={mine} title={title} />
      <div
        className={`flex-1 overflow-y-auto bg-cream px-6 py-6 transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
          selected ? "md:pr-[400px]" : ""
        }`}
      >
        <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
          {/* 3 KPI 대형 카드 */}
          <section aria-label="KPI 대형" className="grid gap-4 md:grid-cols-3">
            <KpiCardLarge
              label="미해결 사고 현황"
              trend="실시간 경보"
              trendDanger
              count={kpi.sago.count}
              numberDanger
              footer="전체 관리 대상 중 즉각 조치 필요 건수"
              right={<Sparkline d={kpi.sago.sparklineD} variant="danger" />}
              delayMs={0}
            />
            <KpiCardLarge
              label="내 미완료 할 일"
              trend={`진행률 ${todoPct}%`}
              count={kpi.todo.count}
              footer="본인에게 배정된 미완료 티켓 수"
              right={
                <KpiProgressBar
                  done={kpi.todo.done}
                  total={kpi.todo.total}
                />
              }
              delayMs={50}
            />
            <KpiCardLarge
              label="오픈 예정 서비스"
              trend="안정적 빌드"
              count={kpi.service.count}
              footer="배포 및 모니터링 준비 단계 서비스"
              right={
                <Sparkline d={kpi.service.sparklineD} variant="neutral" />
              }
              delayMs={100}
            />
          </section>

          {/* 2 그룹박스 */}
          <section className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
            <MetricGroupBox title="재정 및 영업 행정" columns={2}>
              <MetricSubcard
                label="체결 계약"
                value={metrics.contract.value}
                desc={metrics.contract.desc}
                active={metrics.contract.active}
              />
              <MetricSubcard
                label="미수 채권"
                value={metrics.bond.value}
                desc={metrics.bond.desc}
                active={metrics.bond.active}
              />
            </MetricGroupBox>
            <MetricGroupBox title="시스템 리소스 및 모니터링" columns={3}>
              <MetricSubcard
                label="백업 대기"
                value={metrics.backup.value}
                desc={metrics.backup.desc}
              />
              <MetricSubcard
                label="기관 연락처"
                value={metrics.contacts.value}
                desc={metrics.contacts.desc}
              />
              <MetricSubcard
                label="일정 / 활동"
                value={metrics.scheduleActivity.value}
                desc={metrics.scheduleActivity.desc}
              />
            </MetricGroupBox>
          </section>

          {/* 필터 + 테이블 */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <FilterTabs
                active={filter}
                counts={counts}
                onChange={setFilter}
              />
              <span className="text-xs text-ink-muted">
                필터링된 결과: {visible.length}건 표시 중
              </span>
            </div>
            <LiveTable
              items={visible}
              onSelect={(it) =>
                setSelected({ variant: it.variant, row: it.listRow })
              }
            />
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
