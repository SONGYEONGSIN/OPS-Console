"use client";

import { useState } from "react";
import { markTabChecked, saveAreaNote } from "@/features/ops-weekly/actions";
import type { Area } from "@/features/ops-weekly/constants";
import { SaveStatus } from "./SaveStatus";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  reportId: string | null;
  area: Area;
  thisWeek: string;
  nextWeek: string;
  editable: boolean;
};

function ReadOnlyNote({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted">{label}</span>
      <p className="whitespace-pre-wrap text-sm text-ink [overflow-wrap:anywhere]">{text || "—"}</p>
    </div>
  );
}

/** 영역 특이사항(금주/차주) + [이 탭 확인]. blur 하면 저장한다. */
export function AreaNotes(props: Props) {
  const { reportId, area, thisWeek, nextWeek, editable } = props;
  const [thisDraft, setThis] = useState(thisWeek);
  const [nextDraft, setNext] = useState(nextWeek);
  const note = useSave({ track: true });
  const check = useSave();

  function save() {
    if (reportId === null) return;
    if (thisDraft === thisWeek && nextDraft === nextWeek) return;
    note.run(() =>
      saveAreaNote({
        reportId,
        area,
        thisWeek: thisDraft,
        nextWeek: nextDraft,
      }),
    );
  }

  return (
    <section className="flex flex-col gap-3 border-t border-line pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-ink">영역 특이사항</h3>
        {editable && reportId !== null ? (
          <SaveStatus
            pending={note.pending}
            error={note.error}
            savedAt={note.savedAt}
          />
        ) : null}
      </div>
      {editable && reportId !== null ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              금주
              <textarea
                rows={3}
                value={thisDraft}
                onChange={(e) => setThis(e.target.value)}
                onBlur={save}
                className={FIELD_CLASS}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-medium text-muted">
              차주
              <textarea
                rows={3}
                value={nextDraft}
                onChange={(e) => setNext(e.target.value)}
                onBlur={save}
                className={FIELD_CLASS}
              />
            </label>
          </div>
          {note.error ? (
            <p role="alert" className={ERROR_CLASS}>
              {note.error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={check.pending}
              className={BTN_CLASS}
              onClick={() =>
                check.run(() => markTabChecked({ reportId, area }))
              }
            >
              이 탭 확인
            </button>
            <span className="text-xs text-muted">
              확인하면 탭 옆에 확인 표시가 남습니다
            </span>
            {check.error ? <p className={ERROR_CLASS}>{check.error}</p> : null}
          </div>
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          <ReadOnlyNote label="금주" text={thisWeek} />
          <ReadOnlyNote label="차주" text={nextWeek} />
        </div>
      )}
    </section>
  );
}
