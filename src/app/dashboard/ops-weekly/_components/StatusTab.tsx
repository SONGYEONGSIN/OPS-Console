"use client";

import { useState } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ModalShell } from "@/components/common/ModalShell";
import type { ProjectGroup } from "@/features/ops-weekly/merge";
import {
  canEditDutySummary,
  canManageSettings,
  canReturnReport,
  type Actor,
  type FinalizeCheck,
} from "@/features/ops-weekly/permissions";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import {
  normalizedWeekStateOf,
  type ReportRow,
  type WeekRow,
} from "@/features/ops-weekly/schemas";
import {
  finalizeWeek,
  returnReport,
} from "@/features/ops-weekly/workflow-actions";
import { manageHref } from "../_params";
import { DutySummary } from "./DutySummary";
import { ProjectOverview } from "./ProjectOverview";
import { SubmissionTable } from "./SubmissionTable";
import { BTN_CLASS, FIELD_CLASS } from "./styles";
import { useWorkflow } from "./use-workflow";

type Props = {
  week: WeekRow;
  actor: Actor;
  writers: WriterCandidate[];
  reports: ReportRow[];
  projectGroups: ProjectGroup[];
  finalize: FinalizeCheck;
  /** 머리줄의 제출 수와 같은 값 — 같은 사실을 두 번 세지 않는다 */
  submittedCount: number;
};

type Dialog =
  | { kind: "return"; report: ReportRow; name: string }
  | { kind: "finalize" }
  | null;

const LOCKED_TEXT = "이미 보고된 주입니다";

/** 미제출은 적지 않는다 — 누가 안 냈는지는 바로 아래 표의 상태 칸이 보여 준다. */
function whyDisabled(
  check: Exclude<FinalizeCheck, { ok: true }>,
): string | null {
  if (check.reason === "pending") return null;
  if (check.reason === "empty-roster")
    return "작성 대상 명단을 읽지 못했습니다";
  if (check.reason === "locked") return LOCKED_TEXT;
  return null;
}

function ReturnDialog(props: {
  name: string;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  return (
    <ModalShell
      title="다시 작성 요청"
      ariaLabel="다시 작성 요청"
      size="md"
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={BTN_CLASS} onClick={props.onClose}>
            취소
          </button>
          <button
            type="button"
            className={BTN_CLASS}
            onClick={() => {
              props.onSubmit(reason.trim());
            }}
          >
            요청 보내기
          </button>
        </>
      }
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted">
        사유
        <textarea
          rows={3}
          value={reason}
          placeholder={`${props.name}에게 전달할 사유 (선택)`}
          onChange={(e) => {
            setReason(e.target.value);
          }}
          className={FIELD_CLASS}
        />
      </label>
    </ModalShell>
  );
}

function FinalizeDialog(props: { onClose: () => void; onOk: () => void }) {
  return (
    <ModalShell
      title="최종 보고"
      ariaLabel="최종 보고 확인"
      size="sm"
      onClose={props.onClose}
      footer={
        <>
          <button type="button" className={BTN_CLASS} onClick={props.onClose}>
            취소
          </button>
          <button type="button" className={BTN_CLASS} onClick={props.onOk}>
            보고하기
          </button>
        </>
      }
    >
      <p className="text-sm text-ink">
        최종 보고하면 이 주의 보고서가 잠기고 되돌릴 수 없습니다 (정정은
        관리자만 가능). 보고할까요?
      </p>
    </ModalShell>
  );
}

function FinalizeBar(props: {
  finalize: FinalizeCheck;
  pending: boolean;
  onClick: () => void;
}) {
  const { finalize } = props;
  const why = finalize.ok ? null : whyDisabled(finalize);
  return (
    <div className="flex flex-col items-end gap-1">
      <HeaderActionButton
        onClick={props.onClick}
        disabled={!finalize.ok || props.pending}
      >
        최종 보고
      </HeaderActionButton>
      {why === null ? null : (
        <p className="max-w-xs text-right text-xs text-ink-soft">{why}</p>
      )}
    </div>
  );
}

export function StatusTab(props: Props) {
  const { week, actor, writers, reports, projectGroups, finalize } = props;
  const wf = useWorkflow();
  const [dialog, setDialog] = useState<Dialog>(null);
  const state = normalizedWeekStateOf(week);
  const open = week.status === "open";
  return (
    <section data-tab="status" className="flex flex-col gap-7 p-5 lg:p-7">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="flex min-w-0 flex-col gap-2">
            <div className="flex items-baseline gap-2">
              <h2 className="text-xl font-bold text-ink">제출 현황</h2>
              <span className="text-muted" aria-hidden>
                ·
              </span>
              <span className="text-sm tabular-nums text-vermilion">
                {`제출 ${props.submittedCount} / ${writers.length}명`}
              </span>
            </div>
          </div>
          {open ? (
            <div className="ml-auto">
              <FinalizeBar
                finalize={finalize}
                pending={wf.pending}
                onClick={() => {
                  setDialog({ kind: "finalize" });
                }}
              />
            </div>
          ) : null}
        </div>
        {wf.message !== null ? (
          <p role="alert" className="text-xs text-vermilion">
            {wf.message}
          </p>
        ) : null}
      </div>
      <SubmissionTable
        week={week}
        writers={writers}
        reports={reports}
        settingsHref={
          canManageSettings(actor)
            ? manageHref(week.week_start, "exclusions")
            : undefined
        }
        canReturn={(r) => canReturnReport(actor, state, r.status)}
        onReturn={(report, name) => {
          setDialog({ kind: "return", report, name });
        }}
      />
      <DutySummary
        weekId={week.id}
        thisWeek={week.summary_this}
        nextWeek={week.summary_next}
        editable={canEditDutySummary(actor, state)}
      />
      <ProjectOverview groups={projectGroups} />
      {dialog?.kind === "return" ? (
        <ReturnDialog
          name={dialog.name}
          onClose={() => {
            setDialog(null);
          }}
          onSubmit={(reason) => {
            const reportId = dialog.report.id;
            setDialog(null);
            wf.run(() => returnReport({ reportId, reason }));
          }}
        />
      ) : null}
      {dialog?.kind === "finalize" ? (
        <FinalizeDialog
          onClose={() => {
            setDialog(null);
          }}
          onOk={() => {
            setDialog(null);
            wf.run(() => finalizeWeek({ weekId: week.id }));
          }}
        />
      ) : null}
    </section>
  );
}
