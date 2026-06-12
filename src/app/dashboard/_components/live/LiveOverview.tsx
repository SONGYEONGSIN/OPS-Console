"use client";

import { Fragment, useMemo, useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { ToastProvider } from "./ToastContainer";
import { useLiveSidebar } from "./use-live-sidebar";
import { CommandBar } from "./command/CommandBar";
import { LiveStatusBar } from "./command/LiveStatusBar";
import { AutoHeadline } from "./command/AutoHeadline";
import type { HealthGatewayItem } from "./command/HealthGateway";
import type { HeadlineInput } from "./command/headline-selector";
import type { LifecycleStage } from "./lifecycle/LifecyclePipe";
import { FilterTabs, type LiveFilter } from "./FilterTabs";
import { LiveTable } from "./LiveTable";
import { TriageBoard } from "./TriageBoard";
import type { LiveTableItem } from "./live-table-builder";
import type { ConsoleLogEntry } from "./mock-log-pool";

/** OPS-6 stats-band — 라이프사이클 4단계 하단 색 룰 (indigo→amber→sage→gold) */
const LIFECYCLE_BAR = ["bg-indigo", "bg-amber", "bg-sage", "bg-gold"] as const;

/** 메트릭 값 표기 — {num,den} → "num / den", 그 외 그대로 */
function metricVal(
  v: number | string | { num: number; den: number },
): string {
  if (typeof v === "object" && v !== null) return `${v.num} / ${v.den}`;
  return String(v);
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

  return (
    <div className="h-full overflow-y-auto bg-paper">
      {/* PR① 상단 — 커맨드 바(.cmd) + 자동 헤드라인(.headline).
          기존 LivePageHeader + 우측 사이드바(SystemHealth/ConsoleStream)를 대체.
          데이터(시스템 날씨/로그/헤드라인)는 모두 page.tsx → props로 주입. */}
      <div className="px-6 pb-6 pt-6">
        <div className="mx-auto flex max-w-[1680px] flex-col gap-3.5">
          <CommandBar mine={mine} />
          <AutoHeadline input={headline} />
        </div>
      </div>
      <div className="px-6 pb-6">
        {/* 본문 전폭 — KPI / 서브카드 / 테이블 섹션 (이후 PR에서 교체 예정). */}
        <div className="mx-auto max-w-[1680px]">
          <div className="flex flex-col gap-6">
            {/* OPS-6 stats-band — '현황 요약': 라이프사이클 + 메트릭 5종 압축 괘선 밴드. */}
            <section aria-label="현황 요약" className="flex flex-col gap-3">
              <div className="flex items-baseline justify-between border-b-2 border-ink pb-1.5">
                <h2 className="text-sm font-bold tracking-[0.02em] text-ink">
                  현황 요약
                  <span className="ml-2 text-xs font-normal text-muted">
                    라이프사이클 · 핵심 지표
                  </span>
                </h2>
              </div>
              <div className="grid grid-cols-1 border-2 border-ink bg-washi-raised xl:grid-cols-[auto_2px_1fr]">
                <section
                  aria-label="서비스 라이프사이클"
                  className="flex items-stretch overflow-x-auto"
                >
                  <span
                    aria-hidden
                    className="flex w-3.5 shrink-0 items-center justify-center border-r border-line-soft bg-washi text-[7px] uppercase tracking-[0.3em] text-faint [transform:rotate(180deg)] [writing-mode:vertical-rl]"
                  >
                    lifecycle
                  </span>
                  {lifecycle.map((s, i) => (
                  <Fragment key={s.label}>
                    <div className="relative flex min-w-[96px] flex-col justify-center px-4 py-2.5">
                      <span className="mb-1 text-[8px] font-medium uppercase tracking-[0.16em] text-muted">
                        {s.label}
                      </span>
                      <span className="text-2xl font-bold leading-none tracking-[-0.04em] text-ink tabular-nums">
                        {s.count ?? "—"}
                      </span>
                      <span className="mt-1 text-[9px] text-faint">{s.meta}</span>
                      <span
                        aria-hidden
                        className={`absolute inset-x-0 bottom-0 h-[3px] ${LIFECYCLE_BAR[i] ?? "bg-line-soft"}`}
                      />
                    </div>
                    {i < lifecycle.length - 1 && (
                      <span
                        data-pipe-arrow
                        aria-hidden
                        className="flex items-center px-1 text-sm text-faint"
                      >
                        ›
                      </span>
                    )}
                  </Fragment>
                ))}
              </section>
              <div className="hidden bg-ink xl:block" aria-hidden />
              <section
                aria-label="서비스 현황"
                className="grid grid-cols-2 border-t-2 border-ink sm:grid-cols-3 xl:grid-cols-5 xl:border-t-0"
              >
                {[
                  { key: "contract", label: "계약체결", value: metricVal(metrics.contract.value), desc: metrics.contract.desc, bar: "bg-indigo", active: !!metrics.contract.active },
                  { key: "bond", label: "미수채권", value: metricVal(metrics.bond.value), desc: metrics.bond.desc, bar: "bg-vermilion", active: !!metrics.bond.active },
                  { key: "backup", label: "백업내용", value: metricVal(metrics.backup.value), desc: metrics.backup.desc, bar: "bg-amber", active: false },
                  { key: "handover", label: "인수인계", value: metricVal(metrics.handover.value), desc: metrics.handover.desc, bar: "bg-sage", active: false },
                  { key: "contacts", label: "대학연락처", value: metricVal(metrics.contacts.value), desc: metrics.contacts.desc, bar: "bg-gold", active: false },
                ].map((m, i) => (
                  <div
                    key={m.key}
                    className={`relative px-3.5 py-2.5 ${i > 0 ? "border-l border-line-soft" : ""}`}
                  >
                    <span
                      aria-hidden
                      className={`absolute inset-x-0 top-0 h-[3px] ${m.bar}`}
                    />
                    <span className="mb-1 block whitespace-nowrap text-[8px] font-medium uppercase tracking-[0.12em] text-muted">
                      {m.label}
                    </span>
                    <span
                      data-metric={m.key}
                      className={`text-xl font-bold leading-none tracking-[-0.04em] tabular-nums ${m.active ? "text-vermilion" : "text-ink"}`}
                    >
                      {m.value}
                    </span>
                    <span className="mt-1 block text-[9px] text-faint">
                      {m.desc}
                    </span>
                  </div>
                ))}
              </section>
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

      {/* 하단 고정 status bar — 시스템 헬스 + 로그 티커 + LIVE (sticky) */}
      <LiveStatusBar healthItems={healthItems} logLines={lines} />

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
