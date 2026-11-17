"use client";

import { useState } from "react";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import { saveExcludedWriters } from "@/features/ops-weekly/settings-actions";
import { BTN_CLASS, ERROR_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Props = {
  candidates: readonly WriterCandidate[];
  excluded: readonly string[];
};

export function WriterExclusionPanel({ candidates, excluded }: Props) {
  const save = useSettingsSave();
  const [checked, setChecked] = useState<string[]>([...excluded]);
  function toggle(email: string) {
    setChecked(
      checked.includes(email)
        ? checked.filter((e) => e !== email)
        : [...checked, email],
    );
  }
  return (
    <section aria-label="작성 제외" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">작성 제외</h2>
      <p className="text-xs text-muted">
        체크한 사람은 작성 대상에서 영구 제외됩니다(테스트 계정 등). 그 주만
        빼는 기능은 없습니다 — 휴가인 사람은 미리 작성합니다.
      </p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {candidates.map((c) => (
          <li key={c.email}>
            <label className="flex items-center gap-1 text-sm text-ink">
              <input
                type="checkbox"
                aria-label={`${c.name} 제외`}
                checked={checked.includes(c.email)}
                onChange={() => {
                  toggle(c.email);
                }}
              />
              {c.name}
            </label>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={BTN_CLASS}
          disabled={save.pending}
          onClick={() => {
            save.run(() => saveExcludedWriters({ emails: checked }));
          }}
        >
          제외 저장
        </button>
        {save.error !== null ? (
          <p role="alert" className={ERROR_CLASS}>
            {save.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
