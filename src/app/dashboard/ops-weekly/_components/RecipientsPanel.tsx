"use client";

import { useState } from "react";
import { ListSelect } from "@/components/common/ListSelect";
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
import { BADGE_CLASS, BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Props = {
  recipients: SettingsBundle["recipients"];
  candidates: readonly WriterCandidate[];
};

const labelOf = (c: WriterCandidate) => `${c.name} (${c.email})`;

export function RecipientsPanel({ recipients, candidates }: Props) {
  const save = useSettingsSave();
  const [email, setEmail] = useState("");
  const [added, setAdded] = useState<RecipientWarning | null>(null);

  function pick(label: string) {
    const hit = candidates.find((c) => labelOf(c) === label);
    if (hit) setEmail(hit.email);
  }
  function add() {
    save.run(async () => {
      const res = await addRecipient({ email: normEmail(email) });
      setAdded(res.ok ? (res.warning ?? null) : null);
      if (res.ok) setEmail("");
      return res;
    });
  }

  return (
    <section aria-label="받는 사람" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">받는 사람</h2>
      <ul className="flex flex-col gap-1">
        {recipients.map((r) => (
          <li
            key={r.email}
            className="flex flex-wrap items-center gap-2 text-sm"
          >
            <span className="min-w-0 break-words text-ink">
              {r.name ?? r.email}
            </span>
            <span className="min-w-0 break-words text-xs text-muted">
              {r.email}
            </span>
            {r.warning !== null ? (
              <span className={BADGE_CLASS}>
                {RECIPIENT_WARNING_LABEL[r.warning]}
              </span>
            ) : null}
            <button
              type="button"
              className={BTN_CLASS}
              disabled={save.pending}
              aria-label={`${r.name ?? r.email} 삭제`}
              onClick={() => {
                save.run(() => removeRecipient({ email: r.email }));
              }}
            >
              삭제
            </button>
          </li>
        ))}
      </ul>
      {recipients.some((r) => r.warning === "no-menu") ? (
        <p className="text-xs text-muted">권한은 운영자 관리에서 부여합니다</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <ListSelect
          value=""
          onChange={pick}
          options={candidates.map(labelOf)}
          placeholder="운영자에서 고르기"
          ariaLabel="받는 사람 운영자 선택"
          className="max-w-full"
        />
        <input
          aria-label="받는 사람 이메일"
          className={`${FIELD_CLASS} max-w-full`}
          value={email}
          placeholder="이메일 직접 입력"
          onChange={(e) => {
            setEmail(e.target.value);
          }}
        />
        <button
          type="button"
          className={BTN_CLASS}
          disabled={save.pending || email.trim() === ""}
          onClick={add}
        >
          추가
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
