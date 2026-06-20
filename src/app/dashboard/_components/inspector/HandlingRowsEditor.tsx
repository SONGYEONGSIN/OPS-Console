"use client";

import type { HandlingRow } from "@/features/incident-reports/schemas";

const cellClass =
  "border border-line bg-cream px-2 py-1 text-ink focus:border-vermilion focus:bg-situation-bg focus:outline-none";

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
  const removeRow = (i: number) => onChange(rows.filter((_, idx) => idx !== i));

  return (
    <div className="text-xs">
      <span className="mb-1 block text-muted">{label}</span>
      <div className="space-y-1.5">
        {rows.length === 0 && (
          <p className="text-2xs text-muted">
            아래 ‘+ 처리 행 추가’로 시간/내용 행을 추가하세요.
          </p>
        )}
        {rows.map((r, i) => (
          <div key={i} className="flex items-stretch gap-1">
            <input
              type="datetime-local"
              aria-label={`처리 시간 ${i + 1}`}
              value={r.time}
              onChange={(e) => updateRow(i, { time: e.target.value })}
              onClick={(e) => e.currentTarget.showPicker?.()}
              className={`${cellClass} w-36 flex-none cursor-pointer`}
            />
            <textarea
              aria-label={`처리 내용 ${i + 1}`}
              value={r.content}
              rows={2}
              maxLength={2000}
              placeholder="내용 (엔터로 줄바꿈)"
              onChange={(e) => updateRow(i, { content: e.target.value })}
              className={`${cellClass} min-w-0 flex-1`}
            />
            <button
              type="button"
              aria-label={`처리 행 삭제 ${i + 1}`}
              title="행 삭제"
              onClick={() => removeRow(i)}
              className="flex-none cursor-pointer self-start border border-line bg-transparent px-2 py-1 text-muted hover:border-vermilion hover:text-vermilion"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={addRow}
          className="cursor-pointer border border-vermilion bg-transparent px-2.5 py-1 text-2xs font-medium text-vermilion hover:bg-vermilion hover:text-cream"
        >
          + 처리 행 추가
        </button>
      </div>
    </div>
  );
}
