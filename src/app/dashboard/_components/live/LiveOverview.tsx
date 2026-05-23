"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { ToastProvider } from "./ToastContainer";
import { useLiveSidebar } from "./use-live-sidebar";
import { LivePageHeader } from "./LivePageHeader";
import { KpiCardLarge } from "./KpiCardLarge";
import { Sparkline } from "./Sparkline";
import { KpiProgressBar } from "./KpiProgressBar";
import { MetricGroupBox } from "./MetricGroupBox";
import { MetricSubcard } from "./MetricSubcard";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { ConsoleStream } from "./ConsoleStream";
import type { LiveTableItem } from "./live-table-builder";
import type { ConsoleLogEntry } from "./mock-log-pool";

export type LiveOverviewProps = {
  mine: boolean;
  myEmail: string | null;
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
    scheduleActivity: { value: number | string; desc: string };
  };
  tableItems: LiveTableItem[];
  initialConsoleLines?: ConsoleLogEntry[];
};

/** row-pair grid 내부 컴포넌트 — ToastProvider 하위에서 useLiveSidebar 사용 가능. */
function LiveOverviewInner({
  mine,
  myEmail,
  title,
  kpi,
  metrics,
  tableItems,
  initialConsoleLines,
}: LiveOverviewProps) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);
  const { lines } = useLiveSidebar({
    initialLines: initialConsoleLines,
    mine,
    myEmail,
  });

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
    <div
      className={`h-full overflow-y-auto bg-cream transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
        selected ? "md:pr-[400px]" : ""
      }`}
    >
      {/* 헤더를 스크롤 컨테이너 안에 두고 sticky로 고정 → 스크롤바 우측 점유분이
          헤더에도 똑같이 적용돼 토글 우측 라인이 컨텐츠와 정확히 일치. */}
      <div className="sticky top-0 z-10">
        <LivePageHeader mine={mine} title={title} />
      </div>
      <div className="px-6 py-6">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-6">
          {/* Row 1: KPI 3 카드 + 시스템 헬스 */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[3fr_1fr]">
            <section aria-label="KPI 대형" className="grid gap-4 md:grid-cols-3">
              <KpiCardLarge
                label="오픈 예정 서비스"
                trend="오픈 준비"
                count={kpi.service.count}
                footer="배포 준비 완료"
                right={
                  <Sparkline d={kpi.service.sparklineD} variant="neutral" />
                }
                delayMs={0}
              />
              <KpiCardLarge
                label="내 미완 할 일"
                trend={`진행률 ${todoPct}%`}
                count={kpi.todo.count}
                footer="본인 배정 미완료"
                right={
                  <KpiProgressBar
                    done={kpi.todo.done}
                    total={kpi.todo.total}
                  />
                }
                delayMs={50}
              />
              <KpiCardLarge
                label="사고 누적 데이터"
                trend="긴급 대응"
                trendDanger
                count={kpi.sago.count}
                numberDanger
                footer="즉각 조치 필요"
                right={<Sparkline d={kpi.sago.sparklineD} variant="danger" />}
                delayMs={100}
              />
            </section>
            <SystemHealthPanel />
          </div>

          {/* Row 1 아래: 좌·우 독립 stack (좌측 = 그룹박스→테이블, 우측 = 콘솔).
              행별 stretch 없이 각 컬럼이 자기 자식들로 채워짐. */}
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[3fr_1fr]">
            {/* 좌측 컬럼: 그룹박스 → 필터+테이블 */}
            <div className="flex flex-col gap-6">
              <section className="grid gap-4 md:grid-cols-[1fr_1.5fr]">
                <MetricGroupBox title="계약 · 미수채권" columns={2}>
                  <MetricSubcard
                    label="계약체결"
                    value={metrics.contract.value}
                    desc={metrics.contract.desc}
                    active={metrics.contract.active}
                  />
                  <MetricSubcard
                    label="미수채권"
                    value={metrics.bond.value}
                    desc={metrics.bond.desc}
                    active={metrics.bond.active}
                  />
                </MetricGroupBox>
                <MetricGroupBox title="백업 · 연락처 · 일정" columns={3}>
                  <MetricSubcard
                    label="백업내용"
                    value={metrics.backup.value}
                    desc={metrics.backup.desc}
                  />
                  <MetricSubcard
                    label="대학연락처"
                    value={metrics.contacts.value}
                    desc={metrics.contacts.desc}
                  />
                  <MetricSubcard
                    label="일정"
                    value={metrics.scheduleActivity.value}
                    desc={metrics.scheduleActivity.desc}
                  />
                </MetricGroupBox>
              </section>
              <section className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <FilterTabs
                    active={filter}
                    counts={counts}
                    onChange={setFilter}
                  />
                  <span className="text-xs text-ink-muted">
                    {visible.length}건 표시
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
            {/* 우측 컬럼: 콘솔 */}
            <div className="flex flex-col gap-6">
              <ConsoleStream lines={lines} />
            </div>
          </div>
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

export function LiveOverview(props: LiveOverviewProps) {
  return (
    <ToastProvider>
      <LiveOverviewInner {...props} />
    </ToastProvider>
  );
}
