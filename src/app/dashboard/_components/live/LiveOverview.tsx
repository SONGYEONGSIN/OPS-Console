"use client";

import { useState } from "react";
import type { Variant } from "../inspector/list-variants/types";
import type { ListRow } from "../patterns/ListPattern";
import { InspectorPanel } from "../inspector/InspectorPanel";
import { InspectorChrome } from "../inspector/InspectorChrome";
import { InspectorListBody } from "../inspector/InspectorListBody";
import { ToastProvider } from "./ToastContainer";
import { useDashboardRealtime } from "./use-dashboard-realtime";
import type { HealthGatewayItem } from "./command/HealthGateway";
import type { HeadlineInput } from "./command/headline-selector";
import type { LifecycleStage } from "./lifecycle/LifecyclePipe";
import type { LiveTableItem } from "./live-table-builder";
import type { ConsoleLogEntry } from "./mock-log-pool";
import type { ActivityLogEntry } from "./broadsheet/activity-log";
import { Masthead } from "./broadsheet/Masthead";
import { ActivityTimeline } from "./broadsheet/ActivityTimeline";
import { BroadsheetHeadline } from "./broadsheet/BroadsheetHeadline";
import { StatList, type StatRow } from "./broadsheet/StatList";
import { TriageColumns } from "./broadsheet/TriageColumns";
import { PriorityFeed } from "./broadsheet/PriorityFeed";

/** 메트릭 값 표기 — {num,den} → "num / den"(천단위 콤마), 숫자는 콤마, null → "—". */
function fmtVal(
  v: number | string | { num: number; den: number } | null | undefined,
): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "object")
    return `${v.num.toLocaleString("ko-KR")} / ${v.den.toLocaleString("ko-KR")}`;
  if (typeof v === "number") return v.toLocaleString("ko-KR");
  return v;
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
  /** 핵심 지표(broadsheet) — 주요업무/프로젝트/AI산출물/사고처리/서비스마감. */
  keyMetrics: {
    todoWeekly: { done: number; total: number };
    todoProject: { done: number; total: number };
    aiOutputs: number;
    incidents: number;
    serviceClosed: number | null;
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
  /** 시스템 날씨 게이트웨이 항목 (page.tsx에서 snapshot 매핑). */
  healthItems: HealthGatewayItem[];
  /** 로그 라인 시드 (worklog). */
  logLines: ConsoleLogEntry[];
  /** 자동 우선순위 헤드라인 입력. */
  headline: HeadlineInput;
  /** 시스템 로그 패널(마스트헤드 펼치기) — worklog 파생, 시각 보존. */
  activityLog: ActivityLogEntry[];
  /** 가로 타임라인 이벤트 — 9 도메인(오늘 KST, 09–18) 파생. */
  timelineEvents: ActivityLogEntry[];
  /** 현황요약·핵심지표 행 클릭 팝업용 상세 리스트 (라벨 → 행 미리보기). page.tsx 조립. */
  statDetails?: Record<string, { time?: string; title: string }[]>;
};

const SECTION_LABEL =
  "mb-5 border-y border-line py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-muted";
const SECTION_H3 = "mb-1 text-2xl font-black leading-tight tracking-tight";

/** Broadsheet 실시간 현황 본문 — ToastProvider 하위(useDashboardRealtime 토스트 활성). */
function LiveOverviewInner({
  mine,
  myEmail,
  metrics,
  lifecycle,
  keyMetrics,
  tableItems,
  headline,
  activityLog,
  timelineEvents,
  statDetails = {},
}: LiveOverviewProps) {
  const [selected, setSelected] = useState<{
    variant: Variant;
    row: ListRow;
  } | null>(null);

  // 실시간 토스트(사고/할일/백업/프로젝트/AI) 유지 — 콘솔 라인은 broadsheet 미사용.
  useDashboardRealtime({ mine, myEmail, onConsoleLine: () => {} });

  const select = (it: LiveTableItem) =>
    setSelected({ variant: it.variant, row: it.listRow });

  const d = (key: string) => statDetails[key] ?? [];
  const summaryRows: StatRow[] = [
    {
      label: "계약",
      value: fmtVal(metrics.contract.value),
      href: "/dashboard/contracts",
      detailRows: d("계약"),
    },
    {
      label: "오픈예정",
      value: fmtVal(lifecycle[0]?.count),
      href: "/dashboard/closing",
      detailRows: d("오픈예정"),
    },
    {
      label: "진행 중",
      value: fmtVal(lifecycle[1]?.count),
      href: "/dashboard/closing",
      detailRows: d("진행중"),
    },
    {
      label: "마감완료",
      value: fmtVal(lifecycle[2]?.count),
      href: "/dashboard/closing",
      detailRows: d("마감완료"),
    },
    {
      label: "미수채권",
      value: fmtVal(metrics.bond.value),
      tone: "vermilion",
      href: "/dashboard/receivables",
      detailRows: d("미수채권"),
    },
    {
      label: "백업요청",
      value: fmtVal(metrics.backup.value),
      href: "/dashboard/backup",
      detailRows: d("백업요청"),
    },
    {
      label: "인수인계",
      value: fmtVal(metrics.handover.value),
      href: "/dashboard/handover",
      detailRows: d("인수인계"),
    },
    {
      label: "대학연락처",
      value: fmtVal(metrics.contacts.value),
      href: "/dashboard/contacts",
      detailRows: d("대학연락처"),
    },
  ];

  const keyMetricRows: StatRow[] = [
    {
      label: "내 할 일 · 주요업무",
      value: `${keyMetrics.todoWeekly.done} / ${keyMetrics.todoWeekly.total}`,
      href: "/dashboard/my-todo",
      detailRows: d("주요업무"),
    },
    {
      label: "내 할 일 · 프로젝트",
      value: `${keyMetrics.todoProject.done} / ${keyMetrics.todoProject.total}`,
      href: "/dashboard/my-todo",
      detailRows: d("프로젝트"),
    },
    {
      label: "AI 산출물",
      value: fmtVal(keyMetrics.aiOutputs),
      href: "/dashboard/my-ai-work",
      detailRows: d("AI산출물"),
    },
    {
      label: "사고처리",
      value: fmtVal(keyMetrics.incidents),
      tone: "vermilion",
      href: "/dashboard/incidents",
      detailRows: d("사고처리"),
    },
    {
      label: "서비스 마감",
      value: fmtVal(keyMetrics.serviceClosed),
      tone: "sage",
      href: "/dashboard/closing",
      detailRows: d("서비스마감"),
    },
  ];

  return (
    <div className="h-full overflow-y-auto bg-paper">
      <div className="px-4 py-8 md:px-8 md:py-10">
        <div className="border border-line bg-situation-bg p-6 shadow-offset md:p-9">
          <Masthead mine={mine} activityLog={activityLog} />
          <ActivityTimeline entries={timelineEvents} />
          <BroadsheetHeadline input={headline} />

          <div className="grid grid-cols-1 gap-7 lg:grid-cols-12 lg:gap-10">
            {/* 좌(3) — 현황 요약 + 핵심 지표. justify-between으로 핵심지표 하단을
                중앙(트리아지) 하단 라인에 맞춤 (남는 높이는 두 섹션 사이 여백으로). */}
            <div className="flex flex-col gap-9 border-b border-line-soft pb-7 lg:col-span-3 lg:justify-between lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
              <div>
                <h3 className={SECTION_H3}>현황 요약</h3>
                <div className={SECTION_LABEL}>ServiceCycle &amp; Data</div>
                <StatList rows={summaryRows} />
              </div>
              <div>
                <h3 className={SECTION_H3}>핵심 지표</h3>
                <div className={SECTION_LABEL}>Critical Metrics</div>
                <StatList rows={keyMetricRows} />
              </div>
            </div>

            {/* 중앙(6) — 긴급도 분류 */}
            <div className="border-b border-line-soft pb-7 lg:col-span-6 lg:border-b-0 lg:border-r lg:pb-0 lg:pr-10">
              <h3 className={SECTION_H3}>긴급도 분류</h3>
              <div className={`${SECTION_LABEL} flex justify-between`}>
                <span>Triage · 긴급도 기준 자동 분류</span>
                <span className="text-[10px] text-ink-soft">행 클릭 → 상세</span>
              </div>
              <TriageColumns items={tableItems} onSelect={select} />
            </div>

            {/* 우(3) — 우선순위 피드. 데스크탑: absolute로 흐름에서 빼 그리드 높이를
                좌·중앙(고정 트리아지)이 결정하게 하고, 피드는 그 높이를 채우며 내부 스크롤. */}
            <div className="lg:relative lg:col-span-3">
              <PriorityFeed items={tableItems} onSelect={select} />
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
