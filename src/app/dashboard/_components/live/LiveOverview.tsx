"use client";

import { useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { ToastProvider } from "./ToastContainer";
import { useLiveSidebar } from "./use-live-sidebar";
import { CommandBar } from "./command/CommandBar";
import { AutoHeadline } from "./command/AutoHeadline";
import type { HealthGatewayItem } from "./command/HealthGateway";
import type { HeadlineInput } from "./command/headline-selector";
import { KpiCardLarge } from "./KpiCardLarge";
import { Sparkline } from "./Sparkline";
import { KpiProgressBar } from "./KpiProgressBar";
import { MetricGroupBox } from "./MetricGroupBox";
import { MetricSubcard } from "./MetricSubcard";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
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
    contract: {
      value: number | string | { num: number; den: number };
      active?: boolean;
      desc: string;
    };
    bond: {
      value: number | string | { num: number; den: number };
      active?: boolean;
      desc: string;
    };
    backup: { value: number | string; desc: string };
    contacts: { value: number | string; desc: string };
    handover: {
      value: number | string | { num: number; den: number };
      desc: string;
    };
  };
  tableItems: LiveTableItem[];
  initialConsoleLines?: ConsoleLogEntry[];
  /** CommandBar 시스템 날씨 게이트웨이 항목 (page.tsx에서 snapshot 매핑). */
  healthItems: HealthGatewayItem[];
  /** CommandBar 하단 로그 티커 라인 (기존 initialConsoleLines 재사용 가능). */
  logLines: ConsoleLogEntry[];
  /** AutoHeadline 자동 우선순위 헤드라인 입력. */
  headline: HeadlineInput;
};

/** row-pair grid 내부 컴포넌트 — ToastProvider 하위에서 useLiveSidebar 사용 가능. */
function LiveOverviewInner({
  mine,
  myEmail,
  kpi,
  metrics,
  tableItems,
  healthItems,
  logLines,
  headline,
}: LiveOverviewProps) {
  const [filter, setFilter] = useState<LiveFilter>("all");
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);
  // CommandBar 하단 티커 — 서버 시드(logLines)로 시작해 Realtime 라인을 누적.
  const { lines } = useLiveSidebar({
    initialLines: logLines,
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
      handover: 0,
    };
    for (const it of tableItems) {
      if (it.domain === "incidents") c.incidents += 1;
      else if (it.domain === "todos") c.todos += 1;
      else if (it.domain === "services") c.services += 1;
      else if (it.domain === "backup") c.backup += 1;
      else if (it.domain === "handover") c.handover += 1;
    }
    return c;
  }, [tableItems]);

  const visible = useMemo(() => {
    if (filter === "all") return tableItems;
    return tableItems.filter((x) => x.domain === filter);
  }, [filter, tableItems]);

  const todoPct =
    kpi.todo.total > 0 ? Math.round((kpi.todo.done / kpi.todo.total) * 100) : 0;

  return (
    <div className="h-full overflow-y-auto bg-paper">
      {/* PR① 상단 — 커맨드 바(.cmd) + 자동 헤드라인(.headline).
          기존 LivePageHeader + 우측 사이드바(SystemHealth/ConsoleStream)를 대체.
          데이터(시스템 날씨/로그/헤드라인)는 모두 page.tsx → props로 주입. */}
      <div className="px-6 pb-6 pt-6">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3.5">
          <CommandBar mine={mine} healthItems={healthItems} logLines={lines} />
          <AutoHeadline input={headline} />
        </div>
      </div>
      <div className="px-6 pb-6">
        {/* 본문 전폭 — KPI / 서브카드 / 테이블 섹션 (이후 PR에서 교체 예정). */}
        <div className="mx-auto max-w-[1680px]">
          <div className="flex flex-col gap-6">
            <section
              aria-label="KPI 대형"
              className="grid gap-4 md:grid-cols-3"
            >
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
                  <KpiProgressBar done={kpi.todo.done} total={kpi.todo.total} />
                }
                delayMs={50}
              />
              <KpiCardLarge
                label="사고 누적 데이터"
                trend="긴급 대응"
                trendDanger
                count={kpi.sago.count}
                numberDanger
                footer="사고 재발 방지"
                right={<Sparkline d={kpi.sago.sparklineD} variant="danger" />}
                delayMs={100}
              />
            </section>
            <MetricGroupBox title="서비스 현황" columns={5}>
              <MetricSubcard
                label="계약체결"
                value={metrics.contract.value}
                desc={metrics.contract.desc}
                active={metrics.contract.active}
                valueHint="내 계약 중 '계약완료' 상태로 표기된 카운팅"
              />
              <MetricSubcard
                label="미수채권"
                value={metrics.bond.value}
                desc={metrics.bond.desc}
                active={metrics.bond.active}
                valueHint="내 미수채권 중 수금 완료된 건수 카운팅"
              />
              <MetricSubcard
                label="백업내용"
                value={metrics.backup.value}
                desc={metrics.backup.desc}
              />
              <MetricSubcard
                label="인수인계"
                value={metrics.handover.value}
                desc={metrics.handover.desc}
                valueHint="본인 서비스 중 인수인계 내용 작성한 카운팅"
              />
              <MetricSubcard
                label="대학연락처"
                value={metrics.contacts.value}
                desc={metrics.contacts.desc}
              />
            </MetricGroupBox>
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
