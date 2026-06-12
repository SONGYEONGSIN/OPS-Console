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
        className={`text-3xl font-bold leading-none tracking-[-0.04em] tabular-nums ${active ? "text-vermilion" : "text-ink"}`}
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

  return (
    <div className="h-full overflow-y-auto bg-paper">
      {/* 상단 고정 status 띠 — 시스템 헬스 + 로그 티커 + LIVE (sticky top) */}
      <LiveStatusBar healthItems={healthItems} logLines={lines} />
      {/* 상단 — 커맨드 바(.cmd) + 자동 헤드라인(.headline).
          기존 LivePageHeader + 우측 사이드바(SystemHealth/ConsoleStream)를 대체.
          데이터(헤드라인)는 page.tsx → props로 주입. */}
      <div className="px-6 pb-6 pt-6">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3.5">
          <CommandBar mine={mine} />
          <KpiHeroStrip kpi={kpi} />
        </div>
      </div>
      <div className="px-6 pb-6">
        {/* 본문 전폭 — KPI / 서브카드 / 테이블 섹션 (이후 PR에서 교체 예정). */}
        <div className="mx-auto max-w-[1680px]">
          <div className="flex flex-col gap-6">
            {/* OPS-6 stats-band — '현황 요약': 라이프사이클 + 메트릭 5종 압축 괘선 밴드. */}
            <section aria-label="현황 요약" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
                <h2 className="text-xl font-bold tracking-[0.01em] text-ink">
                  현황 요약
                  <span className="ml-2 text-xs font-normal text-muted">
                    라이프사이클 · 핵심 지표
                  </span>
                </h2>
              </div>
              <div className="flex items-stretch overflow-x-auto border-y border-line-soft bg-washi-raised">
                {/* ServiceCycle 라벨 (선두, 검정 배경 + 흰 글씨) */}
                <span
                  aria-hidden
                  className="flex w-5 shrink-0 items-center justify-center bg-ink text-[11px] font-bold tracking-[0.12em] text-cream [transform:rotate(180deg)] [writing-mode:vertical-rl]"
                >
                  ServiceCycle
                </span>
                {/* 9카드 통합 — 계약체결 → 라이프사이클 4 → 미수채권 → 백업 → 인수인계 → 대학연락처.
                    모든 카드 사이에 › 화살표(흐름 표시). */}
                {(
                  [
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
                  ] as SummaryCard[]
                ).map((c, i) => (
                  <Fragment key={c.key}>
                    {i > 0 && (
                      <span
                        data-pipe-arrow
                        aria-hidden
                        className="flex items-center px-1 text-base font-bold text-muted"
                      >
                        ›
                      </span>
                    )}
                    <StatCell
                      label={c.label}
                      value={c.value}
                      sub={c.sub}
                      active={c.active}
                      dataMetric={c.dataMetric}
                    />
                  </Fragment>
                ))}
              </div>
            </section>
            <section aria-label="시급도 분류" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
                <h2 className="text-sm font-bold tracking-[0.02em] text-ink">
                  시급도 분류
                  <span className="ml-2 text-xs font-normal text-muted">
                    긴급도 기준 자동 분류
                  </span>
                </h2>
                <span className="text-xs text-muted">행 클릭 → 상세</span>
              </div>
              <TriageBoard
                items={tableItems}
                onSelect={(it) =>
                  setSelected({ variant: it.variant, row: it.listRow })
                }
              />
            </section>
            <section
              aria-label="전체 우선순위 피드"
              className="flex flex-col gap-3"
            >
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b-2 border-ink pb-1.5">
                <h2 className="shrink-0 text-sm font-bold tracking-[0.02em] text-ink">
                  전체 우선순위 피드
                </h2>
                <FilterTabs
                  active={filter}
                  counts={counts}
                  onChange={setFilter}
                />
                <span className="ml-auto shrink-0 text-xs text-ink-muted">
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
