"use client";

import { normEmail } from "@/features/ops-weekly/email";
import {
  canManageSettings,
  type Actor,
} from "@/features/ops-weekly/permissions";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import type { WeekRow } from "@/features/ops-weekly/schemas";
import { setWeekDuty } from "@/features/ops-weekly/settings-actions";
import { OnOffToggle } from "./OnOffToggle";
import { RosterTable } from "./RosterTable";
import { useWorkflow } from "./use-workflow";

type Props = {
  week: Pick<WeekRow, "id" | "status" | "duty_email">;
  weekLabel: string;
  writers: readonly WriterCandidate[];
  actor: Actor;
};

function currentLine(current: string, writers: readonly WriterCandidate[]) {
  if (current === "") return "지금 당번: 미지정";
  const hit = writers.find((w) => w.email === current);
  // 명단 밖 당번도 isDuty 로 관리 권한을 갖는다 — 미지정으로 보이면 틀린 말이다.
  return hit ? `지금 당번: ${hit.name}` : `지금 당번: ${current} — 명단 밖`;
}

export function DutySection({ week, weekLabel, writers, actor }: Props) {
  const wf = useWorkflow();
  const editable = canManageSettings(actor) && week.status === "open";
  const current = normEmail(week.duty_email ?? "");
  return (
    <section aria-label="당번 지정" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">당번 지정</h2>
      <p className="text-sm tabular-nums text-ink-soft">{weekLabel}</p>
      <p className="text-sm text-ink">{currentLine(current, writers)}</p>
      {week.status === "open" ? null : (
        <p className="text-xs text-ink-soft">
          보고가 끝난 주는 당번을 바꿀 수 없습니다
        </p>
      )}
      <RosterTable
        label="당번 후보"
        rows={writers}
        action={{
          header: "당번",
          cell: (w) => (
            <OnOffToggle
              label={`${w.name} 당번`}
              on={w.email === current}
              lockOff
              disabled={!editable || wf.pending}
              onChange={(next) => {
                if (!next) return;
                wf.run(() =>
                  setWeekDuty({ weekId: week.id, dutyEmail: w.email }),
                );
              }}
            />
          ),
        }}
      />
      {wf.message !== null ? (
        <p role="alert" className="text-xs text-vermilion">
          {wf.message}
        </p>
      ) : null}
    </section>
  );
}
