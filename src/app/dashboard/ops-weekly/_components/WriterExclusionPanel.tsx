"use client";

import { useState } from "react";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import { saveExcludedWriters } from "@/features/ops-weekly/settings-actions";
import { RosterTable } from "./RosterTable";
import { BADGE_CLASS, ERROR_CLASS, ROW_BTN_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Props = {
  candidates: readonly WriterCandidate[];
  excluded: readonly string[];
};

export function WriterExclusionPanel({ candidates, excluded }: Props) {
  const save = useSettingsSave();
  const [emails, setEmails] = useState<string[]>([...excluded]);
  // 누르면 바로 저장한다 — 화면 값을 먼저 바꾸고 전체 목록을 보낸다(서버는 목록을 통째로 받는다).
  function apply(next: string[]) {
    setEmails(next);
    save.run(() => saveExcludedWriters({ emails: next }));
  }
  return (
    <section aria-label="작성 제외" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">작성 제외</h2>
      <p className="text-xs text-muted">
        제외한 사람은 작성 대상에서 영구 제외됩니다(테스트 계정 등). 그 주만
        빼는 기능은 없습니다 — 휴가인 사람은 미리 작성합니다.
      </p>
      <RosterTable
        label="작성 제외 후보"
        rows={candidates}
        action={{
          header: "작성",
          cell: (c) =>
            emails.includes(c.email) ? (
              <>
                <span className={BADGE_CLASS}>제외됨</span>
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  disabled={save.pending}
                  onClick={() => {
                    apply(emails.filter((e) => e !== c.email));
                  }}
                >
                  포함
                </button>
              </>
            ) : (
              <button
                type="button"
                className={ROW_BTN_CLASS}
                disabled={save.pending}
                onClick={() => {
                  apply([...emails, c.email]);
                }}
              >
                제외
              </button>
            ),
        }}
      />
      {save.error !== null ? (
        <p role="alert" className={ERROR_CLASS}>
          {save.error}
        </p>
      ) : null}
    </section>
  );
}
