"use client";

import { useState } from "react";
import { EXCLUDED_WRITER_ROLES } from "@/features/ops-weekly/constants";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import {
  saveExcludedWriters,
  saveIncludedWriters,
} from "@/features/ops-weekly/settings-actions";
import { OnOffToggle } from "./OnOffToggle";
import { RosterTable } from "./RosterTable";
import { ERROR_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

const ROLE_EXCLUDED: ReadonlySet<string> = new Set(EXCLUDED_WRITER_ROLES);
// roster.ts 의 값을 가져오면 server-only 에 닿는다 — 직급 판정은 상수에서 바로 한다.
const isRoleExcluded = (role: string) => ROLE_EXCLUDED.has(role);

type Props = {
  /** 운영1·2팀 활성 전원 — 부장·팀장도 든다 */
  candidates: readonly WriterCandidate[];
  excluded: readonly string[];
  included: readonly string[];
};

/**
 * 작성 제외 — 한 표에서 두 목록을 다룬다. 보통 사람은 ON 이면 제외 목록(테스트 계정 등)에 들고,
 * 부장·팀장은 직급 때문에 기본이 제외(ON)라 OFF 하면 작성 포함 목록에 든다.
 */
export function WriterExclusionPanel({
  candidates,
  excluded,
  included,
}: Props) {
  const save = useSettingsSave();
  const [excl, setExcl] = useState<string[]>([...excluded]);
  const [incl, setIncl] = useState<string[]>([...included]);
  // 누르면 바로 저장한다 — 화면 값을 먼저 바꾸고 전체 목록을 보낸다(서버는 목록을 통째로 받는다).
  function toggle(c: WriterCandidate, exclude: boolean) {
    if (isRoleExcluded(c.role)) {
      const next = exclude
        ? incl.filter((e) => e !== c.email)
        : [...incl, c.email];
      setIncl(next);
      save.run(() => saveIncludedWriters({ emails: next }));
      return;
    }
    const next = exclude
      ? [...excl, c.email]
      : excl.filter((e) => e !== c.email);
    setExcl(next);
    save.run(() => saveExcludedWriters({ emails: next }));
  }
  const isExcluded = (c: WriterCandidate) =>
    excl.includes(c.email) ||
    (isRoleExcluded(c.role) && !incl.includes(c.email));
  return (
    <section aria-label="작성 제외" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">작성 제외</h2>
      <p className="text-xs text-muted">
        ON 인 사람은 작성 대상에서 영구 제외됩니다(테스트 계정 등). 부장·팀장은
        기본이 제외라, 보고서를 쓰게 하려면 OFF 로 바꿉니다. 그 주만 빼는 기능은
        없습니다 — 휴가인 사람은 미리 작성합니다.
      </p>
      <RosterTable
        label="작성 제외 후보"
        rows={candidates}
        action={{
          header: "제외",
          cell: (c) => (
            <OnOffToggle
              label={`${c.name} 작성 제외`}
              on={isExcluded(c)}
              disabled={save.pending}
              onChange={(next) => {
                toggle(c, next);
              }}
            />
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
