"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import { ListSelect } from "@/components/common/ListSelect";
import { ModalShell } from "@/components/common/ModalShell";
import type { ActionResult } from "@/features/ops-weekly/actions";
import { normEmail } from "@/features/ops-weekly/email";
import type { ProjectGroup } from "@/features/ops-weekly/merge";
import {
  canEditDutySummary,
  canReopenWeek,
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
import { setWeekDuty } from "@/features/ops-weekly/settings-actions";
import {
  finalizeWeek,
  reopenWeek,
  returnReport,
} from "@/features/ops-weekly/workflow-actions";
import { DutySummary } from "./DutySummary";
import { ProjectOverview } from "./ProjectOverview";
import { SubmissionTable } from "./SubmissionTable";
import { BTN_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  week: WeekRow;
  actor: Actor;
  writers: WriterCandidate[];
  reports: ReportRow[];
  projectGroups: ProjectGroup[];
  finalize: FinalizeCheck;
};

type Dialog =
  | { kind: "return"; report: ReportRow; name: string }
  | { kind: "finalize" }
  | null;

const LOCKED_TEXT = "이미 보고된 주입니다";

/** 결과와 상관없이 서버 상태가 바뀌었을 수 있어 늘 새로 읽는다(보고 커밋 뒤 후속 실패 포함). */
function useWorkflow() {
  const router = useRouter();
  const save = useSave();
  function run(fn: () => Promise<ActionResult>) {
    save.run(async () => {
      try {
        return await fn();
      } finally {
        router.refresh();
      }
    });
  }
  return { pending: save.pending, message: save.error, run };
}

function whyDisabled(
  check: Exclude<FinalizeCheck, { ok: true }>,
  names: ReadonlyMap<string, string>,
): string {
  if (check.reason === "pending") {
    const who = check.pending.map((e) => names.get(normEmail(e)) ?? e);
    return `미제출: ${who.join(", ")}`;
  }
  if (check.reason === "empty-roster")
    return "작성 대상 명단을 읽지 못했습니다";
  if (check.reason === "locked") return LOCKED_TEXT;
  return "당번 또는 관리자만 보고할 수 있습니다";
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

function DutyPicker(props: {
  week: WeekRow;
  writers: readonly WriterCandidate[];
  onPick: (email: string) => void;
}) {
  const { week, writers, onPick } = props;
  const current = normEmail(week.duty_email ?? "");
  const value = writers.find((w) => w.email === current)?.name ?? "";
  return (
    <ListSelect
      ariaLabel="당번"
      className="max-w-full"
      placeholder="당번 미지정"
      value={value}
      options={writers.map((w) => w.name)}
      onChange={(name) => {
        const w = writers.find((x) => x.name === name);
        if (w) onPick(w.email);
      }}
    />
  );
}

function FinalizeBar(props: {
  finalize: FinalizeCheck;
  names: ReadonlyMap<string, string>;
  pending: boolean;
  onClick: () => void;
}) {
  const { finalize, names } = props;
  return (
    <div className="flex flex-col items-start gap-1">
      <HeaderActionButton
        onClick={props.onClick}
        disabled={!finalize.ok || props.pending}
      >
        최종 보고
      </HeaderActionButton>
      {finalize.ok ? null : (
        <p className="text-xs text-ink-soft">{whyDisabled(finalize, names)}</p>
      )}
    </div>
  );
}

export function StatusTab(props: Props) {
  const { week, actor, writers, reports, projectGroups, finalize } = props;
  const wf = useWorkflow();
  const [dialog, setDialog] = useState<Dialog>(null);
  const state = normalizedWeekStateOf(week);
  const names = new Map(writers.map((w) => [normEmail(w.email), w.name]));
  const open = week.status === "open";

  return (
    <section data-tab="status" className="flex flex-col gap-6 p-5 lg:p-7">
      {wf.message !== null ? (
        <p role="status" className="text-xs text-ink-soft">
          {wf.message}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        {open ? (
          <FinalizeBar
            finalize={finalize}
            names={names}
            pending={wf.pending}
            onClick={() => {
              setDialog({ kind: "finalize" });
            }}
          />
        ) : null}
        {canReopenWeek(actor, state) ? (
          <button
            type="button"
            className={BTN_CLASS}
            disabled={wf.pending}
            onClick={() => {
              wf.run(() => reopenWeek({ weekId: week.id }));
            }}
          >
            정정
          </button>
        ) : null}
        {actor.isAdmin && open ? (
          <DutyPicker
            week={week}
            writers={writers}
            onPick={(email) => {
              wf.run(() => setWeekDuty({ weekId: week.id, dutyEmail: email }));
            }}
          />
        ) : null}
      </div>
      <SubmissionTable
        week={week}
        writers={writers}
        reports={reports}
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
