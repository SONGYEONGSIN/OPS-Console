"use client";

import { useState } from "react";
import { saveDutySummary } from "@/features/ops-weekly/workflow-actions";
import { ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  weekId: string;
  thisWeek: string;
  nextWeek: string;
  editable: boolean;
};

function ReadOnly({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <p className="whitespace-pre-wrap break-words text-sm text-ink">
        {text || "—"}
      </p>
    </div>
  );
}

/** 주요(운영부 전체) 금주/차주 — blur 하면 저장한다. */
export function DutySummary(props: Props) {
  const { weekId, thisWeek, nextWeek, editable } = props;
  const [thisDraft, setThis] = useState(thisWeek);
  const [nextDraft, setNext] = useState(nextWeek);
  const save = useSave();

  function persist() {
    if (thisDraft === thisWeek && nextDraft === nextWeek) return;
    save.run(() =>
      saveDutySummary({ weekId, thisWeek: thisDraft, nextWeek: nextDraft }),
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-bold text-ink">주요 (운영부 전체)</h3>
      {editable ? (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            금주
            <textarea
              rows={4}
              value={thisDraft}
              onChange={(e) => {
                setThis(e.target.value);
              }}
              onBlur={persist}
              className={FIELD_CLASS}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted">
            차주
            <textarea
              rows={4}
              value={nextDraft}
              onChange={(e) => {
                setNext(e.target.value);
              }}
              onBlur={persist}
              className={FIELD_CLASS}
            />
          </label>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnly label="금주" text={thisWeek} />
          <ReadOnly label="차주" text={nextWeek} />
        </div>
      )}
      {save.error ? <p className={ERROR_CLASS}>{save.error}</p> : null}
    </section>
  );
}
