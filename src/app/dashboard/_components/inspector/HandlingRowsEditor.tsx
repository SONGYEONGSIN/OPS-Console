"use client";

import { useLayoutEffect, useRef } from "react";
import type { HandlingRow } from "@/features/incident-reports/schemas";
import { DateInput } from "@/components/common/DateInput";

const cellClass =
  "border border-line-soft bg-field-bg px-2 py-1 text-ink focus:border-ink focus:bg-white focus:outline-none";

/** 내용 칸 — 줄 수에 맞춰 높이를 늘이고 줄인다(rows=2가 최소). */
function ContentTextarea({
  value,
  onValueChange,
  ariaLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = (el: HTMLTextAreaElement) => {
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  };
  // 값이 밖에서 바뀌는 경우(초기 로드·행 삭제로 값이 밀림)도 맞춘다.
  useLayoutEffect(() => {
    if (ref.current) fit(ref.current);
  }, [value]);
  return (
    <textarea
      ref={ref}
      aria-label={ariaLabel}
      value={value}
      rows={2}
      maxLength={2000}
      placeholder="내용 (엔터로 줄바꿈)"
      onChange={(e) => {
        fit(e.target);
        onValueChange(e.target.value);
      }}
      className={`${cellClass} min-w-0 flex-1 resize-none overflow-hidden`}
    />
  );
}

/**
 * 처리(시간/내용) 행 편집기 — 경위서·사고보고 공용.
 * 내용 칸은 textarea라 엔터 줄바꿈 지원. 불변 갱신만 사용(onChange로 새 배열 전달).
 */
export function HandlingRowsEditor({
  rows,
  onChange,
  label = "처리 — 왼쪽 칸=일시, 오른쪽 칸=내용",
}: {
  rows: HandlingRow[];
  onChange: (rows: HandlingRow[]) => void;
  label?: string;
}) {
  const updateRow = (i: number, patch: Partial<HandlingRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const addRow = () => onChange([...rows, { time: "", content: "" }]);
  const removeLastRow = () => onChange(rows.slice(0, -1));

  return (
    <div className="text-xs">
      <span className="mb-1 block text-muted">{label}</span>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <p className="text-2xs text-muted">
            아래 ‘+ 행 추가’로 시간/내용 행을 추가하세요.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-stretch gap-1">
            <DateInput
              type="datetime-local"
              aria-label={`처리 시간 ${i + 1}`}
              value={r.time}
              onChange={(e) => updateRow(i, { time: e.target.value })}
              className={`${cellClass} w-36 flex-none cursor-pointer`}
            />
            <ContentTextarea
              ariaLabel={`처리 내용 ${i + 1}`}
              value={r.content}
              onValueChange={(v) => updateRow(i, { content: v })}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-end gap-1.5">
        <button
          type="button"
          onClick={addRow}
          className="cursor-pointer border border-vermilion bg-transparent px-2.5 py-1 text-2xs font-medium text-vermilion hover:bg-vermilion hover:text-cream"
        >
          + 행 추가
        </button>
        <button
          type="button"
          onClick={removeLastRow}
          disabled={rows.length === 0}
          className="cursor-pointer border border-line bg-transparent px-2.5 py-1 text-2xs font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent disabled:hover:text-ink"
        >
          − 행 삭제
        </button>
      </div>
    </div>
  );
}
