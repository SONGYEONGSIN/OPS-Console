"use client";

import { useState } from "react";
import { DateInput } from "@/components/common/DateInput";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import { saveRotation } from "@/features/ops-weekly/settings-actions";
import { RosterTable, type RosterRow } from "./RosterTable";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS, ROW_BTN_CLASS } from "./styles";
import { useSettingsSave } from "./use-settings-save";

type Props = {
  rotation: readonly string[];
  anchorWeekStart: string | null;
  writers: readonly WriterCandidate[];
};

const NOT_MONDAY = "기준 주는 월요일이어야 합니다.";

/** 서버가 다시 검증한다 — 여기서는 왕복 없이 사유를 보여 주려는 것. */
function isMonday(ymd: string): boolean {
  const d = new Date(`${ymd}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.getUTCDay() === 1;
}

function move(list: readonly string[], i: number, by: -1 | 1): string[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

/** 순번에 든 사람을 순서대로 먼저, 나머지를 그 뒤에 — 명단 밖 순번도 행으로 남긴다. */
function rowsOf(
  emails: readonly string[],
  writers: readonly WriterCandidate[],
): RosterRow[] {
  const byEmail = new Map(writers.map((w) => [w.email, w]));
  const inRotation: RosterRow[] = emails.map((e) => {
    const w = byEmail.get(e);
    return { email: e, name: w?.name ?? null, team: w?.team ?? null };
  });
  const rest = writers.filter((w) => !emails.includes(w.email));
  return [...inRotation, ...rest];
}

export function RotationPanel({ rotation, anchorWeekStart, writers }: Props) {
  const save = useSettingsSave();
  const [emails, setEmails] = useState<string[]>([...rotation]);
  const [anchor, setAnchor] = useState(anchorWeekStart ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  function submit() {
    if (anchor !== "" && !isMonday(anchor)) {
      setLocalError(NOT_MONDAY);
      return;
    }
    setLocalError(null);
    save.run(() =>
      saveRotation({ emails, anchorWeekStart: anchor === "" ? null : anchor }),
    );
  }

  return (
    <section aria-label="당번 순번" className="flex flex-col gap-3">
      <h2 className="text-xl font-bold text-ink">당번 순번</h2>
      <p className="text-xs text-muted">
        기준 주에 1번이 당번이고 매주 다음 순번으로 넘어갑니다. 이미 열린 주의
        당번은 바뀌지 않습니다. 순서를 바꾼 뒤 [순번 저장]을 누르세요.
      </p>
      <RosterTable
        label="당번 순번 명단"
        rows={rowsOf(emails, writers)}
        lead={{
          header: "순번",
          cell: (r) => {
            const i = emails.indexOf(r.email);
            return i < 0 ? "—" : i + 1;
          },
        }}
        action={{
          header: "순번",
          cell: (r) => {
            const i = emails.indexOf(r.email);
            if (i < 0) {
              return (
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  onClick={() => {
                    setEmails([...emails, r.email]);
                  }}
                >
                  넣기
                </button>
              );
            }
            return (
              <>
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  disabled={i === 0}
                  onClick={() => {
                    setEmails(move(emails, i, -1));
                  }}
                >
                  위로
                </button>
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  disabled={i === emails.length - 1}
                  onClick={() => {
                    setEmails(move(emails, i, 1));
                  }}
                >
                  아래로
                </button>
                <button
                  type="button"
                  className={ROW_BTN_CLASS}
                  onClick={() => {
                    setEmails(emails.filter((x) => x !== r.email));
                  }}
                >
                  빼기
                </button>
              </>
            );
          },
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-muted">
          기준 주(월요일)
          <DateInput
            className={FIELD_CLASS}
            value={anchor}
            onChange={(e) => {
              setAnchor(e.target.value);
            }}
          />
        </label>
        <button
          type="button"
          className={BTN_CLASS}
          disabled={save.pending}
          onClick={submit}
        >
          순번 저장
        </button>
        {localError !== null || save.error !== null ? (
          <p role="alert" className={ERROR_CLASS}>
            {localError ?? save.error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
