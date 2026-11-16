"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ListSelect } from "@/components/common/ListSelect";
import type { ReportStatus } from "@/features/ops-weekly/constants";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import type { WeekRef } from "@/features/ops-weekly/week";
import { submitReport } from "@/features/ops-weekly/workflow-actions";
import { formatMdHm } from "../_format";
import { opsWeeklyHref } from "../_params";

type Props = {
  weekRef: WeekRef;
  week: WeekRow;
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
  prevOpen: boolean;
  prevHref: string;
  nextHref: string;
  /** 작성자를 바꿔도 같은 탭에 머문다. */
  tab?: string;
};

// 제출이 이미 커밋된 뒤의 후속 실패(전원 제출 확인 등) 문구의 머리말 — 실패로 포장하지 않는다.
const COMMITTED_PREFIX = "제출은 끝났지만";

const NAV_LINK =
  "border border-line-soft px-2 py-0.5 text-xs text-ink-soft hover:border-ink hover:bg-ink hover:text-cream";

function SubmitSlot(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const { canSubmit, reportId, reportStatus, submittedAt } = props;

  function submit() {
    if (reportId === null) return;
    startTransition(async () => {
      const res = await submitReport({ reportId });
      setMessage(res.ok ? null : res.error);
      // 성공이든 실패든 서버 상태가 바뀌었을 수 있다(제출 뒤 후속 실패 포함).
      router.refresh();
    });
  }

  if (canSubmit) {
    return (
      <>
        <HeaderActionButton onClick={submit} disabled={pending}>
          제출완료
        </HeaderActionButton>
        {message !== null ? <Notice message={message} /> : null}
      </>
    );
  }
  if (reportStatus === "submitted" && submittedAt) {
    return <span>{`제출함 ${formatMdHm(submittedAt)}`}</span>;
  }
  return message !== null ? <Notice message={message} /> : null;
}

function Notice({ message }: { message: string }) {
  const committed = message.startsWith(COMMITTED_PREFIX);
  return (
    <span
      role={committed ? "status" : "alert"}
      className={committed ? "text-ink-soft" : "text-vermilion"}
    >
      {message}
    </span>
  );
}

export function WeekHeader(props: Props) {
  const router = useRouter();
  const { weekRef, week, writers, viewedEmail, prevOpen } = props;
  const viewedName = writers.find((w) => w.email === viewedEmail)?.name ?? "";

  function pickWriter(name: string) {
    const w = writers.find((x) => x.name === name);
    if (w)
      router.push(
        opsWeeklyHref(week.week_start, props.tab ?? "application", w.email),
      );
  }

  return (
    <div className="flex flex-col gap-2 px-7 pt-4 text-sm text-ink">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href={props.prevHref} aria-label="이전 주" className={NAV_LINK}>
          ‹
        </Link>
        <span className="font-semibold">{`${weekRef.label} · ${weekRef.rangeLabel}`}</span>
        <Link href={props.nextHref} aria-label="다음 주" className={NAV_LINK}>
          ›
        </Link>
        {writers.length > 0 ? (
          <ListSelect
            ariaLabel="작성자"
            value={viewedName}
            onChange={pickWriter}
            options={writers.map((w) => w.name)}
          />
        ) : null}
        <span className="tabular-nums text-ink-soft">{`제출 ${props.submittedCount}/${props.writerCount}`}</span>
        <span className="text-ink-soft">{`당번 ${props.dutyName ?? "미지정"}`}</span>
        <SubmitSlot {...props} />
      </div>
      {week.status === "reported" && week.reported_at ? (
        <div className="text-xs text-ink-soft">{`${formatMdHm(week.reported_at)} 최종 보고 — 잠김`}</div>
      ) : null}
      {prevOpen ? (
        <div className="flex items-center gap-2 text-xs text-vermilion">
          <span>지난주 보고가 아직 끝나지 않았습니다</span>
          <Link href={props.prevHref} className="underline">
            지난주로
          </Link>
        </div>
      ) : null}
    </div>
  );
}
