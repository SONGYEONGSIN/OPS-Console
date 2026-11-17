"use client";

import { useState } from "react";
import { DateInput } from "@/components/common/DateInput";
import { ListSelect } from "@/components/common/ListSelect";
import type { WriterCandidate } from "@/features/ops-weekly/roster";
import { saveRotation } from "@/features/ops-weekly/settings-actions";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
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

const labelOf = (w: WriterCandidate) => `${w.name} (${w.email})`;

export function RotationPanel({ rotation, anchorWeekStart, writers }: Props) {
  const save = useSettingsSave();
  const [emails, setEmails] = useState<string[]>([...rotation]);
  const [anchor, setAnchor] = useState(anchorWeekStart ?? "");
  const [localError, setLocalError] = useState<string | null>(null);
  const nameOf = new Map(writers.map((w) => [w.email, w.name]));
  const addable = writers.filter((w) => !emails.includes(w.email));

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
      <h2 className="text-sm font-semibold text-ink">당번 순번</h2>
      <ol className="flex flex-col gap-1">
        {emails.map((e, i) => (
          <li key={e} className="flex flex-wrap items-center gap-2 text-sm">
            <span className="w-5 text-xs text-muted tabular-nums">{i + 1}</span>
            <span className="min-w-0 flex-1 break-words text-ink">
              {nameOf.get(e) ?? e}
            </span>
            <button
              type="button"
              className={BTN_CLASS}
              disabled={i === 0}
              onClick={() => {
                setEmails(move(emails, i, -1));
              }}
            >
              위로
            </button>
            <button
              type="button"
              className={BTN_CLASS}
              disabled={i === emails.length - 1}
              onClick={() => {
                setEmails(move(emails, i, 1));
              }}
            >
              아래로
            </button>
            <button
              type="button"
              className={BTN_CLASS}
              onClick={() => {
                setEmails(emails.filter((x) => x !== e));
              }}
            >
              빼기
            </button>
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <ListSelect
          value=""
          onChange={(label) => {
            const hit = addable.find((w) => labelOf(w) === label);
            if (hit) setEmails([...emails, hit.email]);
          }}
          options={addable.map(labelOf)}
          placeholder="순번에 추가"
          ariaLabel="순번에 추가"
          className="max-w-full"
        />
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
      </div>
      <p className="text-xs text-muted">
        기준 주에 첫 사람이 당번이고 매주 다음 사람으로 넘어갑니다. 이미 열린
        주의 당번은 바뀌지 않습니다.
      </p>
      {localError !== null || save.error !== null ? (
        <p role="alert" className={ERROR_CLASS}>
          {localError ?? save.error}
        </p>
      ) : null}
    </section>
  );
}
