"use client";

import { useState } from "react";
import { DateInput } from "@/components/common/DateInput";
import { addManualItem } from "@/features/ops-weekly/actions";
import type { AutoArea } from "@/features/ops-weekly/constants";
import { LEAVE_TYPE_VALUES } from "@/features/backup-requests/schemas";
import { BTN_CLASS, ERROR_CLASS, FIELD_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  reportId: string;
  area: AutoArea;
  groupKey: string | null;
  leave?: boolean;
};

/** 직접 추가 — 제목 필수. 휴가/외근이면 기간·구분이 붙는다. */
export function ManualItemForm({ reportId, area, groupKey, leave }: Props) {
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [kind, setKind] = useState("");
  // 저장 중에 제출이 눌려도 기다리고, 실패한 채로는 제출되지 않게 등록한다(영역별 키).
  const { pending, error, run } = useSave({
    track: { key: `manual:${reportId}:${area}`, label: "직접 추가" },
  });

  function submit() {
    run(async () => {
      const res = await addManualItem({
        reportId,
        area,
        groupKey,
        title,
        note,
        periodStart: leave ? start || null : null,
        periodEnd: leave ? end || null : null,
        leaveKind: leave ? kind || null : null,
      });
      if (res.ok) {
        setTitle("");
        setNote("");
        setStart("");
        setEnd("");
        setKind("");
      }
      return res;
    });
  }

  return (
    <div className="flex flex-col gap-2 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          aria-label="직접 추가 제목"
          placeholder="직접 추가 — 제목"
          value={title}
          maxLength={200}
          onChange={(e) => setTitle(e.target.value)}
          className={`${FIELD_CLASS} min-w-48 flex-1`}
        />
        <input
          type="text"
          aria-label="직접 추가 메모"
          placeholder="메모"
          value={note}
          maxLength={1000}
          onChange={(e) => setNote(e.target.value)}
          className={`${FIELD_CLASS} min-w-32 flex-1`}
        />
        {leave ? (
          <>
            <DateInput
              aria-label="시작일"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className={FIELD_CLASS}
            />
            <DateInput
              aria-label="종료일"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className={FIELD_CLASS}
            />
            <select
              aria-label="구분"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              className={FIELD_CLASS}
            >
              <option value="">구분</option>
              {LEAVE_TYPE_VALUES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <button
          type="button"
          disabled={pending}
          className={BTN_CLASS}
          onClick={submit}
        >
          추가
        </button>
      </div>
      {error ? <p className={ERROR_CLASS}>{error}</p> : null}
    </div>
  );
}
