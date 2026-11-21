"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListSelect } from "@/components/common/ListSelect";
import { AREAS, type ReportStatus } from "@/features/ops-weekly/constants";
import type { WeekRef } from "@/features/ops-weekly/week";
import { formatMdHm } from "../_format";
import type { HeaderWeek } from "../_header-week";
import { opsWeeklyHref } from "../_params";
import { BADGE_CLASS } from "./styles";
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
  /** 작성자 선택 상자 — null 이면 상자가 없다. viewedEmail 이 null 이면 아무도 안 골라진 상태. */
  writerPicker: {
    writers: readonly { email: string; name: string }[];
    viewedEmail: string | null;
  } | null;
  reportStatus: ReportStatus | null;
  submittedAt?: string | null;
  /** 다시 작성 요청에 적힌 사유 */
  returnReason?: string | null;
  prevOpen: boolean;
  prevHref: string;
  nextHref: string;
  /** 남의 보고서를 보는 중이면 그 사람 이름과 제출 현황으로 돌아가는 주소. */
  viewingOther: { name: string; backHref: string } | null;
};

const NAV_LINK =
  "inline-flex min-h-9 min-w-9 items-center justify-center border border-line-soft px-2 py-0.5 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-cream";

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
  if (status === "draft") return <span className={BADGE_CLASS}>작성 중</span>;
  return null;
}

/** 서버가 준 주 이동 주소의 `tab` 을 지금 영역으로 — replaceState 뒤 서버 값은 낡았다. */
function withTab(href: string, tab: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  return `${path}?${params.toString()}`;
}

export function WeekHeader(props: Props) {
  const router = useRouter();
  const { area } = useOpsArea();
  const { weekRef, week, writerPicker, prevOpen, reportStatus } = props;
  const writers = writerPicker?.writers ?? [];
  const viewedEmail = writerPicker?.viewedEmail ?? null;
  const viewedName = writers.find((w) => w.email === viewedEmail)?.name ?? "";
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

  function pickWriter(name: string) {
    const w = writers.find((x) => x.name === name);
    if (w) router.push(opsWeeklyHref(week.week_start, area, w.email));
  }

  return (
    <div className="flex flex-col gap-2 px-5 pt-4 lg:px-7 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <div className="flex min-w-0 items-center gap-x-2">
            <Link href={prevHref} aria-label="이전 주" className={NAV_LINK}>
              ‹
            </Link>
            <span className="min-w-0 text-base font-bold tabular-nums">{`${weekRef.label} · ${weekRef.rangeLabel}`}</span>
            <Link href={nextHref} aria-label="다음 주" className={NAV_LINK}>
              ›
            </Link>
          </div>
          {writerPicker !== null ? (
            <ListSelect
              ariaLabel="작성자"
              className="w-full max-w-full sm:w-auto"
              value={viewedName}
              onChange={pickWriter}
              options={writers.map((w) => w.name)}
              placeholder={viewedEmail === null ? "작성자 선택" : undefined}
            />
          ) : null}
          {props.viewingOther !== null ? (
            <span className="flex items-center gap-2 text-xs">
              <span className="border border-line-soft px-1.5 py-0.5 text-xs font-bold text-ink">
                {`${props.viewingOther.name}의 보고서`}
              </span>
              <Link
                href={props.viewingOther.backHref}
                className="text-ink-soft underline"
              >
                ‹ 제출 현황
              </Link>
            </span>
          ) : null}
        </div>
        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-ink-soft">
          {/* 제출 현황·관리에서는 아래 표가 제출·당번을 보여 줘서 머리띠에 다시 적지 않는다. */}
          {props.showReportState ? (
            <>
              <StatusBadge
                status={reportStatus}
                submittedAt={props.submittedAt}
              />
              <span className="tabular-nums">{`확인 ${props.checkedCount}/${AREAS.length}`}</span>
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
