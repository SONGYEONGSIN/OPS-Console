"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

const PRIORITY_OPTIONS = [
  { value: "low" as const, label: "낮음" },
  { value: "medium" as const, label: "보통" },
  { value: "high" as const, label: "높음" },
];

const STATUS_OPTIONS = [
  { value: "todo" as const, label: "시작전" },
  { value: "in_progress" as const, label: "진행중" },
  { value: "done" as const, label: "완료" },
  { value: "blocked" as const, label: "보류" },
];

function isoToKstDate(iso?: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

function kstDateToIso(date: string): string {
  if (!date) return "";
  return new Date(`${date}T00:00:00+09:00`).toISOString();
}

export function WeeklyTodoForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="할 일 제목"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">설명</span>
        <textarea
          aria-label="설명"
          value={row.body ?? ""}
          onChange={(e) => setRow({ ...row, body: e.target.value })}
          rows={3}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="설명 (선택)"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">카테고리</span>
        <input
          aria-label="카테고리"
          value={row.category ?? ""}
          onChange={(e) => setRow({ ...row, category: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 신제품 프로모션"
        />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">우선순위</span>
          <select
            aria-label="우선순위"
            value={row.priority ?? "medium"}
            onChange={(e) =>
              setRow({ ...row, priority: e.target.value as ListRow["priority"] })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">상태</span>
          <select
            aria-label="상태"
            value={row.todoStatus ?? "todo"}
            onChange={(e) =>
              setRow({
                ...row,
                todoStatus: e.target.value as ListRow["todoStatus"],
              })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-ink"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">마감일 (KST)</span>
        <input
          type="date"
          aria-label="마감일"
          value={isoToKstDate(row.dueAt)}
          onChange={(e) =>
            setRow({
              ...row,
              dueAt: e.target.value ? kstDateToIso(e.target.value) : null,
            })
          }
          className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">진행률</span>
        <div className="flex items-center gap-2">
          <input
            type="range"
            aria-label="진행률"
            min={0}
            max={100}
            step={5}
            value={row.progress ?? 0}
            onChange={(e) =>
              setRow({ ...row, progress: Number(e.target.value) })
            }
            className="flex-1 accent-vermilion"
          />
          <span className="font-mono text-xs text-ink">
            {row.progress ?? 0}%
          </span>
        </div>
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90"
        >
          저장
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
        >
          취소
        </button>
      </div>
      {row.id !== "" && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  "이 todo를 삭제하시겠습니까? 되돌릴 수 없습니다.",
                )
              ) {
                onSave({ ...row, status: "deleted" });
              }
            }}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
