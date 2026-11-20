"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ListSelect } from "@/components/common/ListSelect";
import type { ReportStatus } from "@/features/ops-weekly/constants";
import type { WeekRef } from "@/features/ops-weekly/week";
import { submitReport } from "@/features/ops-weekly/workflow-actions";
import { formatMdHm } from "../_format";
import type { HeaderWeek } from "../_header-week";
import { opsWeeklyHref } from "../_params";
import { usePendingSaves } from "./pending-saves";
import { BADGE_CLASS } from "./styles";

type Props = {
  weekRef: WeekRef;
  week: HeaderWeek;
  viewedName: string | null;
  writers: { email: string; name: string }[];
  viewedEmail: string | null;
  submittedCount: number;
  writerCount: number;
  dutyName: string | null;
  canSubmit: boolean;
  reportStatus: ReportStatus | null;
  submittedAt?: string | null;
  reportId: string | null;
  /** 다시 작성 요청에 적힌 사유 */
  returnReason?: string | null;
  prevOpen: boolean;
  prevHref: string;
  nextHref: string;
  /** 작성자를 고르면 가는 영역. */
  tab?: string;
  /** 남의 보고서를 보는 중이면 그 사람 이름과 제출 현황으로 돌아가는 주소. */
  viewingOther: { name: string; backHref: string } | null;
};

// 제출이 이미 커밋된 뒤의 후속 실패(전원 제출 확인 등) 문구의 머리말 — 실패로 포장하지 않는다.
const COMMITTED_PREFIX = "제출은 끝났지만";
// action 이 던졌을 때(명단·원천 조회 실패 등) — 에러 경계로 올라가 페이지가 날아가지 않게 받는다.
const SUBMIT_FAILED = "제출하지 못했습니다 — 잠시 후 다시 시도하세요";
// 자동 저장이 실패한 채로는 제출하지 않는다 — 저장되지 않은 글이 빠진 보고서가 나가기 때문이다.
const SAVE_BLOCKED = "저장되지 않은 내용이 있어 제출하지 않았습니다";
const SAVE_TIMEOUT =
  "저장이 끝나지 않아 제출하지 않았습니다 — 잠시 후 다시 시도하세요";
const SAVE_WAITING = "저장 중인 항목을 기다리는 중…";

const NAV_LINK =
  "inline-flex min-h-9 min-w-9 items-center justify-center border border-line-soft px-2 py-0.5 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-cream";

function useSubmit(reportId: string | null) {
  const router = useRouter();
  const saves = usePendingSaves();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  // 저장을 기다리는 동안의 잠금·안내는 전환(transition) 밖에서 건다 — 비동기 전환 안의 상태는
  // 그 작업이 끝날 때까지 화면에 반영되지 않아 안내가 안 보인다.
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reportId === null || busy) return;
    setBusy(true);
    try {
      // blur 저장이 아직 나가는 중일 수 있다 — 끝날 때까지 기다리고, 실패했으면 제출하지 않는다.
      if (saves) {
        setWaiting(saves.hasPending());
        const settled = await saves.settle();
        setWaiting(false);
        if (settled.status === "timeout") {
          setMessage(SAVE_TIMEOUT);
          return;
        }
        if (settled.status === "failed") {
          setMessage(`${SAVE_BLOCKED} — ${settled.message}`);
          return;
        }
      }
      startTransition(async () => {
        try {
          const res = await submitReport({ reportId });
          setMessage(res.ok ? null : res.error);
        } catch {
          setMessage(SUBMIT_FAILED);
        } finally {
          // 성공이든 실패든 서버 상태가 바뀌었을 수 있다(제출 뒤 후속 실패 포함).
          router.refresh();
        }
      });
    } finally {
      setBusy(false);
    }
  }
  return { pending: pending || busy, message, waiting, submit };
}

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

function Notice({ message }: { message: string }) {
  const committed = message.startsWith(COMMITTED_PREFIX);
  return (
    <p
      role={committed ? "status" : "alert"}
      className={`md:self-end ${committed ? "text-ink-soft" : "text-vermilion"}`}
    >
      {message}
    </p>
  );
}

export function WeekHeader(props: Props) {
  const router = useRouter();
  const { weekRef, week, writers, viewedEmail, prevOpen, reportStatus } = props;
  const viewedName = writers.find((w) => w.email === viewedEmail)?.name ?? "";
  const submit = useSubmit(props.reportId);
  const locked = week.status === "reported" && week.reported_at;
  const returnReason =
    reportStatus === "returned" && props.returnReason
      ? props.returnReason
      : null;
  const hasMessages =
    submit.message !== null ||
    submit.waiting ||
    locked ||
    returnReason !== null ||
    prevOpen;

  function pickWriter(name: string) {
    const w = writers.find((x) => x.name === name);
    if (w)
      router.push(
        opsWeeklyHref(week.week_start, props.tab ?? "application", w.email),
      );
  }

  return (
    <div className="flex flex-col gap-2 px-5 pt-4 lg:px-7 text-sm text-ink">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <Link href={props.prevHref} aria-label="이전 주" className={NAV_LINK}>
            ‹
          </Link>
          <span className="text-base font-bold tabular-nums">{`${weekRef.label} · ${weekRef.rangeLabel}`}</span>
          <Link href={props.nextHref} aria-label="다음 주" className={NAV_LINK}>
            ›
          </Link>
          {writers.length > 0 ? (
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
          <StatusBadge status={reportStatus} submittedAt={props.submittedAt} />
          <span className="flex items-center gap-2">
            <span className="tabular-nums">{`제출 ${props.submittedCount}/${props.writerCount}`}</span>
            <span aria-hidden className="text-muted">
              ·
            </span>
            <span>{`당번 ${props.dutyName ?? "미지정"}`}</span>
          </span>
          {props.canSubmit ? (
            <HeaderActionButton
              onClick={submit.submit}
              disabled={submit.pending}
            >
              제출완료
            </HeaderActionButton>
          ) : null}
        </div>
      </div>
      {hasMessages ? (
        <div className="flex flex-col gap-1 text-xs">
          {submit.waiting ? (
            <p role="status" className="text-ink-soft md:self-end">
              {SAVE_WAITING}
            </p>
          ) : null}
          {submit.message !== null ? <Notice message={submit.message} /> : null}
          {returnReason !== null ? (
            <p className="text-vermilion">{`다시 작성 요청 — ${returnReason}`}</p>
          ) : null}
          {locked ? (
            <p className="text-ink-soft">{`${formatMdHm(week.reported_at ?? "")} 최종 보고 — 잠김`}</p>
          ) : null}
          {prevOpen ? (
            <div className="flex items-center gap-2 text-vermilion">
              <span>지난주 보고가 아직 끝나지 않았습니다</span>
              <Link href={props.prevHref} className="underline">
                지난주로
              </Link>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
