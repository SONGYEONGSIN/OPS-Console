"use client";

import { useState } from "react";
import type { AutoArea } from "@/features/ops-weekly/constants";
import { saveItemOverride } from "@/features/ops-weekly/actions";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  reportId: string | null;
  itemKey: string;
  area: AutoArea;
  note: string;
  excluded: boolean;
  editable: boolean;
};

/** 건별 메모 + 빼기/되살리기. 자동 목록 묶음과 휴가 탭이 같이 쓴다. */
export function OverrideControls(props: Props) {
  const { reportId, itemKey, area, note, excluded, editable } = props;
  const [draft, setDraft] = useState(note);
  const { pending, error, run } = useSave();

  if (!editable || reportId === null) {
    return note ? <p className="text-xs text-muted">{note}</p> : null;
  }
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          aria-label="건 메모"
          placeholder="특이사항"
          value={draft}
          maxLength={1000}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft === note) return;
            run(() =>
              saveItemOverride({ reportId, itemKey, area, note: draft }),
            );
          }}
          className={`${FIELD_CLASS} min-w-0 flex-1`}
        />
        <button
          type="button"
          disabled={pending}
          className={BTN_CLASS}
          onClick={() =>
            run(() =>
              saveItemOverride({
                reportId,
                itemKey,
                area,
                excluded: !excluded,
              }),
            )
          }
        >
          {excluded ? "되살리기" : "빼기"}
        </button>
      </div>
      {error ? <p className={ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}
