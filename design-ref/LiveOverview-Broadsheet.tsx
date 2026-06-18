"use client";

import { Fragment, useMemo, useState, type ReactNode } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { ToastProvider } from "./ToastContainer";
import { useLiveSidebar } from "./use-live-sidebar";
import { CommandBar } from "./command/CommandBar";
import { LiveStatusBar } from "./command/LiveStatusBar";
import { KpiHeroStrip } from "./KpiHeroStrip";
import type { HealthGatewayItem } from "./command/HealthGateway";
import type { HeadlineInput } from "./command/headline-selector";
import type { LifecycleStage } from "./lifecycle/LifecyclePipe";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
import { TriageBoard } from "./TriageBoard";
import type { LiveTableItem } from "./live-table-builder";
import type { ConsoleLogEntry } from "./mock-log-pool";
import { AutoHeadline } from "./command/AutoHeadline";
import { TodayFlow } from "./TodayFlow";

/** 메트릭 값 표기 — {num,den} → "num / den", 그 외 그대로 */
function metricVal(v: number | string | { num: number; den: number }): string {
  if (typeof v === "object" && v !== null) return `${v.num} / ${v.den}`;
  return String(v);
}

/** 현황 요약 카드 1개 데이터. */
type SummaryCard = {
  key: string;
  label: string;
  value: string | number;
  sub?: ReactNode;
  active?: boolean;
  dataMetric?: string;
};

/** 현황 요약 통계 셀 — 작은 라벨 + 큰 메인 숫자 + 작은 서브 (색 띠 없음). */
function StatCell({
  label,
  value,
  sub,
  active = false,
  dataMetric,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  active?: boolean;
  dataMetric?: string;
}) {
  return (
    <div className="flex min-w-[128px] flex-1 flex-col justify-center px-4 py-6">
      <span className="mb-2 block whitespace-nowrap text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
        {label}
      </span>
      <span
        data-metric={dataMetric}
        className={`whitespace-nowrap text-2xl font-bold leading-none tracking-[-0.04em] tabular-nums ${active ? "text-vermilion" : "text-ink"}`}
      >
        {value}
      </span>
      {sub ? (
        <span className="mt-2 block text-[10px] text-faint">{sub}</span>
      ) : null}
    </div>
  );
}

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
  /** ② 서비스 라이프사이클 4 스테이지 (soon → prog → done → settle). page.tsx 조립. */
  lifecycle: LifecycleStage[];
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
  lifecycle,
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
      schedule: 0,
      contracts: 0,
      notice: 0,
      receivables: 0,
    };
    for (const it of tableItems) {
      if (it.domain === "incidents") c.incidents += 1;
      else if (it.domain === "todos") c.todos += 1;
      else if (it.domain === "services") c.services += 1;
      else if (it.domain === "backup") c.backup += 1;
      else if (it.domain === "handover") c.handover += 1;
      else if (it.domain === "schedule") c.schedule += 1;
      else if (it.domain === "contracts") c.contracts += 1;
      else if (it.domain === "notice") c.notice += 1;
      else if (it.domain === "receivables") c.receivables += 1;
    }
    return c;
  }, [tableItems]);

  const visible = useMemo(() => {
    if (filter === "all") return tableItems;
    return tableItems.filter((x) => x.domain === filter);
  }, [filter, tableItems]);

  // 통합 Summary 데이터 생성
  const summaryCards: SummaryCard[] = [
    {
      key: "contract",
      label: "계약체결",
      value: metricVal(metrics.contract.value),
      sub: metrics.contract.desc,
      active: !!metrics.contract.active,
    },
    ...lifecycle.map((s) => ({
      key: s.variant,
      label: s.label,
      value: s.count ?? "—",
      sub: s.meta,
    })),
    {
      key: "bond",
      label: "미수채권",
      value: metricVal(metrics.bond.value),
      sub: metrics.bond.desc,
      active: !!metrics.bond.active,
      dataMetric: "bond",
    },
    {
      key: "backup",
      label: "백업내용",
      value: metricVal(metrics.backup.value),
      sub: metrics.backup.desc,
    },
    {
      key: "handover",
      label: "인수인계",
      value: metricVal(metrics.handover.value),
      sub: metrics.handover.desc,
    },
    {
      key: "contacts",
      label: "대학연락처",
      value: metricVal(metrics.contacts.value),
      sub: metrics.contacts.desc,
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-paper text-ink font-serif selection:bg-vermilion selection:text-cream">
      {/* 상단 고정 status 띠 — 시스템 헬스 + 로그 티커 + LIVE (sticky top) */}
      <LiveStatusBar healthItems={healthItems} logLines={lines} />
      
      {/* 파격 콘셉트 2: Broadsheet Newspaper 레이아웃 적용 */}
      <div className="px-4 py-8 md:px-8 md:py-12">
        <div className="mx-auto max-w-[1400px] bg-cream border border-line shadow-[8px_8px_0_var(--line-soft)] p-6 md:p-10 relative">
          
          {/* Masthead (제호) */}
          <div className="text-center border-b-[4px] border-ink pb-6 mb-8 relative">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-line pb-2 mb-6 gap-2">
              <div className="flex items-center gap-4 text-xs font-bold tracking-widest text-muted uppercase">
                <CommandBar mine={mine} />
              </div>
              <div className="text-xs font-bold text-muted uppercase tracking-[0.2em]">
                Vol. {new Date().getFullYear()} / {new Date().getMonth() + 1}
                <span className="ml-4 text-vermilion font-black">LIVE UPDATE</span>
              </div>
            </div>
            
            <h1 className="text-5xl md:text-[80px] font-black tracking-[-0.04em] leading-none m-0 uppercase text-ink font-sans">
              THE OPS CHRONICLE
            </h1>
            <div className="text-sm md:text-base font-semibold text-muted tracking-[0.25em] mt-4 uppercase">
              Real-Time System Monitoring & Intelligence
            </div>
          </div>
          
          {/* Main Headline */}
          <div className="mb-12 border border-line shadow-[4px_4px_0_var(--line-soft)] bg-paper">
            <AutoHeadline input={headline} />
          </div>

          {/* 다단 레이아웃 (3단) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
            
            {/* 좌측 단 (3) - 지표 요약 */}
            <div className="lg:col-span-3 flex flex-col gap-10 border-b lg:border-b-0 lg:border-r border-line-soft lg:pr-12 pb-8 lg:pb-0">
              <div className="article">
                <h3 className="text-2xl font-black leading-tight mb-2 tracking-tight font-sans">핵심 지표</h3>
                <div className="border-y border-line py-1 text-[10px] font-bold text-muted uppercase tracking-[0.1em] mb-6">Critical Metrics</div>
                <KpiHeroStrip kpi={kpi} />
              </div>
              
              <div className="article">
                <h3 className="text-2xl font-black leading-tight mb-2 tracking-tight font-sans">현황 요약</h3>
                <div className="border-y border-line py-1 text-[10px] font-bold text-muted uppercase tracking-[0.1em] mb-6">Lifecycle & Data</div>
                <div className="flex flex-col border-y border-line-soft bg-washi-raised divide-y divide-line-soft font-sans">
                  {summaryCards.map((c) => (
                    <div key={c.key} className="flex flex-row items-center justify-between px-4 py-3">
                      <div>
                        <span className="block text-[10px] font-bold uppercase tracking-[0.1em] text-muted">{c.label}</span>
                        {c.sub && <span className="block text-2xs text-faint mt-0.5">{c.sub}</span>}
                      </div>
                      <span
                        data-metric={c.dataMetric}
                        className={`text-xl font-bold tracking-[-0.04em] tabular-nums ${c.active ? "text-vermilion" : "text-ink"}`}
                      >
                        {c.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 중앙 단 (6) - 타임라인 및 트리아지 */}
            <div className="lg:col-span-6 flex flex-col gap-12 border-b lg:border-b-0 lg:border-r border-line-soft lg:pr-12 pb-8 lg:pb-0 font-sans">
              <div className="article">
                <h3 className="text-3xl font-black leading-tight mb-2 tracking-tight text-ink">현장 대응 타임라인</h3>
                <div className="border-y border-line py-1 text-xs font-bold text-muted uppercase tracking-[0.1em] mb-6 flex justify-between">
                  <span>By SRE Team</span>
                  <span className="text-vermilion">LIVE STREAM</span>
                </div>
                <TodayFlow
                  items={tableItems}
                  onSelect={(it) => setSelected({ variant: it.variant, row: it.listRow })}
                />
              </div>
              
              <div className="article">
                <h3 className="text-3xl font-black leading-tight mb-2 tracking-tight text-ink">시급도 분류</h3>
                <div className="border-y border-line py-1 text-xs font-bold text-muted uppercase tracking-[0.1em] mb-6">Triage Protocol</div>
                <TriageBoard
                  items={tableItems}
                  onSelect={(it) => setSelected({ variant: it.variant, row: it.listRow })}
                />
              </div>
            </div>

            {/* 우측 단 (3) - 피드 */}
            <div className="lg:col-span-3 flex flex-col gap-8 font-sans">
              <div className="article h-full flex flex-col">
                <h3 className="text-2xl font-black leading-tight mb-2 tracking-tight text-ink">우선순위 피드</h3>
                <div className="border-y border-line py-1 text-xs font-bold text-muted uppercase tracking-[0.1em] mb-6 flex justify-between">
                  <span>Live Feed</span>
                  <span>{visible.length}건</span>
                </div>
                <div className="mb-4">
                  <FilterTabs
                    active={filter}
                    counts={counts}
                    onChange={setFilter}
                  />
                </div>
                <div className="flex-1">
                  <LiveTable
                    items={visible}
                    onSelect={(it) => setSelected({ variant: it.variant, row: it.listRow })}
                  />
                </div>
              </div>
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
