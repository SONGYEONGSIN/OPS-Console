"use client";

import Link from "next/link";
import { AREAS, type ReportStatus } from "@/features/ops-weekly/constants";
import type { WeekRef } from "@/features/ops-weekly/week";
import { formatMdHm } from "../_format";
import type { HeaderWeek } from "../_header-week";
import { ALL_OP, opsWeeklyHref } from "../_params";
import { useOpsArea } from "./use-ops-area";

type Props = {
  weekRef: WeekRef;
  week: HeaderWeek;
  submittedCount: number;
  writerCount: number;
  dutyName: string | null;
  /** 내 보고서 화면에서만 상태 배지·확인 수·제출 수·당번을 보인다(제출 현황·관리에는 없다). */
  showReportState: boolean;
  checkedCount: number;
  /**
   * 내 보고서 | 전체 보고서 토글 — null 이면 없다. mine 은 작성자일 때만 누를 수 있다(아니면 비활성 칸).
   * mineOp 는 내 보고서 링크의 op — 관리자·당번은 기본이 전체 보고라 `me` 를 단다.
   * active 는 지금 보는 것(남의 보고서를 보는 중이면 null — 둘 다 꺼진다). 전체 보고 중에는 내 상태 배지·확인 수가 없다.
   */
  scope: {
    mine: boolean;
    mineOp: string | null;
    active: "mine" | "all" | null;
  } | null;
  reportStatus: ReportStatus | null;
  submittedAt?: string | null;
  /** 다시 작성 요청에 적힌 사유 */
  returnReason?: string | null;
  prevOpen: boolean;
  prevHref: string;
  nextHref: string;
};

// 높이는 오늘 할 일(WeeklyView)의 ‹ › 그대로 — py-1(8) + text-sm 줄높이(20) + 테두리(2) = 30px. 가로를 같게 해 정사각형. 호버는 버튼 표준(검정).
const NAV_LINK =
  "inline-flex size-7.5 shrink-0 items-center justify-center border border-line text-sm text-ink hover:border-ink hover:bg-ink hover:text-cream";

function StatusBadge(props: {
  status: ReportStatus | null;
  submittedAt?: string | null;
}) {
  const { status, submittedAt } = props;
  if (status === "submitted") {
    return (
      <span className="border border-line-soft px-1.5 py-0.5 text-xs tabular-nums text-ink">
        {submittedAt ? `제출함 ${formatMdHm(submittedAt)}` : "제출함"}
      </span>
    );
  }
  if (status === "returned") {
    return (
      <span className="border border-vermilion px-1.5 py-0.5 text-xs text-vermilion">
        다시 작성 요청
      </span>
    );
  }
  // 아직 안 낸 것은 할 일이라 빨갛게 — 다시 작성 요청과 같은 색이다. 제출하면 회색 `제출함 시각` 으로 바뀐다.
  if (status === "draft") {
    return (
      <span className="border border-vermilion px-1.5 py-0.5 text-xs text-vermilion">
        작성 중
      </span>
    );
  }
  return null;
}

/** 서버가 준 주 이동 주소의 `tab` 을 지금 영역으로 — replaceState 뒤 서버 값은 낡았다. */
function withTab(href: string, tab: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  return `${path}?${params.toString()}`;
}

// 오늘 할 일의 내 업무 | 전체 업무(MineScopeToggle)와 같은 모양
const SEG_BASE = "px-3 py-1 text-xs";
const SEG_ON = "bg-ink text-cream";
const SEG_OFF = "bg-transparent text-ink hover:text-vermilion";

/** 링크라 서버가 그 범위로 다시 읽는다. */
function ScopeToggle(props: {
  scope: NonNullable<Props["scope"]>;
  weekStart: string;
  area: string;
}) {
  const { scope, weekStart, area } = props;
  const items = [
    {
      key: "mine" as const,
      label: "내 보고서",
      op: scope.mineOp,
      enabled: scope.mine,
    },
    { key: "all" as const, label: "전체 보고서", op: ALL_OP, enabled: true },
  ];
  return (
    <div className="flex items-center border border-line">
      {items.map((it, i) => {
        const cls = `${SEG_BASE} ${i > 0 ? "border-l border-line" : ""}`;
        if (!it.enabled) {
          return (
            <span
              key={it.key}
              aria-disabled="true"
              title="작성 대상 명단에 없어 본인 보고서가 없습니다"
              className={`${cls} text-muted opacity-50`}
            >
              {it.label}
            </span>
          );
        }
        const on = scope.active === it.key;
        return (
          <Link
            key={it.key}
            href={opsWeeklyHref(weekStart, area, it.op)}
            aria-current={on ? "page" : undefined}
            className={`${cls} cursor-pointer ${on ? SEG_ON : SEG_OFF}`}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

export function WeekHeader(props: Props) {
  const { area } = useOpsArea();
  const { weekRef, week, prevOpen, reportStatus } = props;
  const showOwnState = props.showReportState && props.scope?.active !== "all";
  const prevHref = props.showReportState
    ? withTab(props.prevHref, area)
    : props.prevHref;
  const nextHref = props.showReportState
    ? withTab(props.nextHref, area)
    : props.nextHref;
  const locked = week.status === "reported" && week.reported_at;
  const returnReason =
    reportStatus === "returned" && props.returnReason
      ? props.returnReason
      : null;
  const hasMessages = locked || returnReason !== null || prevOpen;

  return (
    <div className="flex flex-col gap-2 px-5 pt-4 lg:px-7 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-x-2">
            <Link href={prevHref} aria-label="이전 주" className={NAV_LINK}>
              ‹
            </Link>
            <span className="min-w-0 text-base font-bold tracking-[-0.02em] tabular-nums">{`${weekRef.label} · ${weekRef.rangeLabel}`}</span>
            <Link href={nextHref} aria-label="다음 주" className={NAV_LINK}>
              ›
            </Link>
          </div>
          {props.scope !== null ? (
            <ScopeToggle
              scope={props.scope}
              weekStart={week.week_start}
              area={area}
            />
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-ink-soft">
          {/* 제출 현황·관리에서는 아래 표가 제출·당번을 보여 줘서 머리띠에 다시 적지 않는다. */}
          {props.showReportState ? (
            <>
              {showOwnState ? (
                <>
                  <StatusBadge
                    status={reportStatus}
                    submittedAt={props.submittedAt}
                  />
                  <span className="tabular-nums">{`확인 ${props.checkedCount}/${AREAS.length}`}</span>
                </>
              ) : null}
              <span className="flex items-center gap-2">
                <span className="tabular-nums">{`제출 ${props.submittedCount}/${props.writerCount}`}</span>
                <span aria-hidden className="text-muted">
                  ·
                </span>
                <span>{`당번 ${props.dutyName ?? "미지정"}`}</span>
              </span>
            </>
          ) : null}
        </div>
      </div>
      {hasMessages ? (
        <div className="flex flex-col gap-1 text-xs">
          {returnReason !== null ? (
            <p className="text-vermilion">{`다시 작성 요청 — ${returnReason}`}</p>
          ) : null}
          {locked ? (
            <p className="text-ink-soft">{`${formatMdHm(week.reported_at ?? "")} 최종 보고 — 잠김`}</p>
          ) : null}
          {prevOpen ? (
            <div className="flex items-center gap-2 text-vermilion">
              <span>지난주 보고가 아직 끝나지 않았습니다</span>
              <Link href={prevHref} className="underline">
                지난주로
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
