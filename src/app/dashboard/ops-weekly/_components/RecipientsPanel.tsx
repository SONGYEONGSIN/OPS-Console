"use client";

import { normEmail } from "@/features/ops-weekly/email";
import {
  RECIPIENT_WARNING_LABEL,
  type RecipientWarning,
} from "@/features/ops-weekly/recipient-warning";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import {
  addRecipient,
  removeRecipient,
} from "@/features/ops-weekly/settings-actions";
import type { SettingsBundle } from "@/features/ops-weekly/settings-queries";
import { OnOffToggle } from "./OnOffToggle";
import { RosterTable, type RosterRow } from "./RosterTable";
import { BADGE_CLASS, ERROR_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Props = {
  recipients: SettingsBundle["recipients"];
  candidates: readonly WriterCandidate[];
};

type Row = RosterRow & { warning: RecipientWarning | null; picked: boolean };

/** 받는 사람 중 운영자 명단 밖 주소를 먼저, 그다음 운영자 명단 — 받는 사람을 지우지 않고 다 보인다. */
function rowsOf(
  recipients: Props["recipients"],
  candidates: Props["candidates"],
): Row[] {
  const picked = new Map(recipients.map((r) => [r.email, r]));
  const known = new Set(candidates.map((c) => c.email));
  const outside: Row[] = recipients
    .filter((r) => !known.has(r.email))
    .map((r) => ({
      email: r.email,
      name: r.name,
      team: null,
      warning: r.warning,
      picked: true,
    }));
  const listed: Row[] = candidates.map((c) => ({
    email: c.email,
    name: c.name,
    team: c.team,
    warning: picked.get(c.email)?.warning ?? null,
    picked: picked.has(c.email),
  }));
  return [...outside, ...listed];
}

export function RecipientsPanel({ recipients, candidates }: Props) {
  const save = useSettingsSave();
  return (
    <section aria-label="받는 사람" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">받는 사람</h2>
      <p className="text-xs text-muted">
        최종 보고 링크를 메일로 받는 사람입니다(부장·팀장님). 누르면 바로
        저장됩니다.
      </p>
      <RosterTable
        label="받는 사람 후보"
        rows={rowsOf(recipients, candidates)}
        action={{
          header: "받는 사람",
          cell: (r) => (
            <>
              {r.picked && r.warning !== null ? (
                <span className={BADGE_CLASS}>
                  {RECIPIENT_WARNING_LABEL[r.warning]}
                </span>
              ) : null}
              <OnOffToggle
                label={`${r.name ?? r.email} 받는 사람`}
                on={r.picked}
                disabled={save.pending}
                onChange={(next) => {
                  save.run(() =>
                    next
                      ? addRecipient({ email: normEmail(r.email) })
                      : removeRecipient({ email: r.email }),
                  );
                }}
              />
            </>
          ),
        }}
      />
      {recipients.some((r) => r.warning === "no-menu") ? (
        <p className="text-xs text-muted">권한은 운영자 관리에서 부여합니다</p>
      ) : null}
      {save.error !== null ? (
        <p role="alert" className={ERROR_CLASS}>
          {save.error}
        </p>
      ) : null}
    </section>
  );
}
