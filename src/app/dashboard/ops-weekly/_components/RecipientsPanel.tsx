"use client";

import { useState } from "react";
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
import { RosterTable, type RosterRow } from "./RosterTable";
import {
  BADGE_CLASS,
  BTN_CLASS,
  ERROR_CLASS,
  FIELD_CLASS,
  ROW_BTN_CLASS,
} from "./styles";
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
  const [email, setEmail] = useState("");
  const [added, setAdded] = useState<RecipientWarning | null>(null);

  function add(target: string, clearInput: boolean) {
    save.run(async () => {
      const res = await addRecipient({ email: normEmail(target) });
      setAdded(res.ok ? (res.warning ?? null) : null);
      if (res.ok && clearInput) setEmail("");
      return res;
    });
  }

  return (
    <section aria-label="받는 사람" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">받는 사람</h2>
      <p className="text-xs text-muted">
        최종 보고 링크를 메일로 받는 사람입니다(부장·팀장님).
      </p>
      <RosterTable
        label="받는 사람 후보"
        rows={rowsOf(recipients, candidates)}
        action={{
          header: "받는 사람",
          cell: (r) =>
            r.picked ? (
              <>
                {r.warning !== null ? (
                  <span className={BADGE_CLASS}>
                    {RECIPIENT_WARNING_LABEL[r.warning]}
                  </span>
                ) : (
                  <span className={BADGE_CLASS}>받는 사람</span>
                )}
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  disabled={save.pending}
                  aria-label="빼기"
                  onClick={() => {
                    save.run(() => removeRecipient({ email: r.email }));
                  }}
                >
                  빼기
                </button>
              </>
            ) : (
              <button
                type="button"
                className={ROW_BTN_CLASS}
                disabled={save.pending}
                onClick={() => {
                  add(r.email, false);
                }}
              >
                추가
              </button>
            ),
        }}
      />
      {recipients.some((r) => r.warning === "no-menu") ? (
        <p className="text-xs text-muted">권한은 운영자 관리에서 부여합니다</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input
          aria-label="받는 사람 이메일"
          className={`${FIELD_CLASS} max-w-full`}
          value={email}
          placeholder="명단 밖 이메일 직접 입력"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <button
          type="button"
          className={BTN_CLASS}
          disabled={save.pending || email.trim() === ""}
          onClick={() => {
            add(email, true);
          }}
        >
          이메일 추가
        </button>
      </div>
      {added !== null ? (
        <p role="status" className="text-xs text-ink-soft">
          추가했습니다 — {RECIPIENT_WARNING_LABEL[added]}
        </p>
      ) : null}
      {save.error !== null ? (
        <p role="alert" className={ERROR_CLASS}>
          {save.error}
        </p>
      ) : null}
    </section>
  );
}
