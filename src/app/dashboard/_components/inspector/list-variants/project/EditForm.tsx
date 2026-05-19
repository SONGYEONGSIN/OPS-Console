"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";

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

export function ProjectForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">프로젝트명</span>
        <input
          aria-label="프로젝트명"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
          placeholder="예: 신제품 프로모션"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">설명</span>
        <textarea
          aria-label="설명"
          value={row.description ?? ""}
          onChange={(e) => setRow({ ...row, description: e.target.value })}
          rows={3}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">책임자</span>
        <select
          aria-label="책임자"
          value={row.projectOwnerEmail ?? ""}
          onChange={(e) => {
            const email = e.target.value;
            const found = OPERATORS.find((o) => o.email === email);
            setRow({
              ...row,
              projectOwnerEmail: email,
              owner: found?.name ?? "",
            });
          }}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        >
          <option value="">선택</option>
          {OPERATORS.map((op) => (
            <option key={op.email} value={op.email}>
              {op.name} · {op.role}
            </option>
          ))}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">시작일</span>
          <input
            type="date"
            aria-label="시작일"
            value={row.startDateYmd ?? ""}
            onChange={(e) =>
              setRow({ ...row, startDateYmd: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">마감일</span>
          <input
            type="date"
            aria-label="마감일"
            value={row.endDateYmd ?? ""}
            onChange={(e) =>
              setRow({ ...row, endDateYmd: e.target.value || null })
            }
            className="w-full border border-line bg-cream px-2 py-1 text-xs text-ink"
          />
        </label>
      </div>
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
      <div className="space-y-1.5">
        <span className="text-xs text-muted">진행률</span>
        <div className="flex items-center gap-2">
          <div className="h-2.5 flex-1 border border-line bg-cream">
            <div
              className="h-full bg-sage"
              style={{ width: `${row.progress ?? 0}%` }}
            />
          </div>
          <span className="font-mono text-xs text-ink">
            {row.progress ?? 0}%
          </span>
        </div>
        <p className="text-2xs text-muted">
          하위 업무 진행률 평균으로 자동 산출됩니다.
        </p>
      </div>
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
                  "프로젝트와 모든 sub-task가 삭제됩니다. 되돌릴 수 없습니다.",
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
