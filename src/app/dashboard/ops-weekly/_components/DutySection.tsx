"use client";

import { normEmail } from "@/features/ops-weekly/email";
import { dutyNameOf } from "@/features/ops-weekly/overview";
import { canManageSettings, type Actor } from "@/features/ops-weekly/permissions";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import { setWeekDuty } from "@/features/ops-weekly/settings-actions";
import { DutyPicker } from "./DutyPicker";
import { useWorkflow } from "./use-workflow";

type Props = {
  week: Pick<WeekRow, "id" | "status" | "duty_email">;
  weekLabel: string;
  writers: readonly WriterCandidate[];
  actor: Actor;
};

export function DutySection({ week, weekLabel, writers, actor }: Props) {
  const wf = useWorkflow();
  const editable = canManageSettings(actor) && week.status === "open";
  const current = normEmail(week.duty_email ?? "");
  // 명단 밖 당번도 isDuty 로 관리 권한을 갖는다 — 미지정으로 보이면 틀린 말이다.
  const outOfRoster =
    current !== "" && !writers.some((w) => w.email === current);
  return (
    <section aria-label="당번 지정" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">당번 지정</h2>
      <p className="text-sm tabular-nums text-ink-soft">{weekLabel}</p>
      {editable ? (
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-soft">
          <span>당번</span>
          <DutyPicker
            week={week}
            writers={writers}
            onPick={(email) => {
              wf.run(() => setWeekDuty({ weekId: week.id, dutyEmail: email }));
            }}
          />
          {outOfRoster ? (
            <span className="text-xs text-ink-soft">{`지금 당번 ${current} — 명단 밖`}</span>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-1 text-sm">
          <p className="text-ink">{dutyNameOf(week.duty_email, writers)}</p>
          {week.status === "open" ? null : (
            <p className="text-xs text-ink-soft">
              보고가 끝난 주는 당번을 바꿀 수 없습니다
            </p>
          )}
        </div>
      )}
      {wf.message !== null ? (
        <p role="alert" className="text-xs text-vermilion">
          {wf.message}
        </p>
      ) : null}
    </section>
  );
}
