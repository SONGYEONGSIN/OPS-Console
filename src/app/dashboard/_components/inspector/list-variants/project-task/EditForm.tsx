"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { OPERATORS } from "@/features/auth/operators";
import { DateInput } from "@/components/common/DateInput";

const CHECKLIST_MAX = 10;

/** 간단 uuid v4 (RFC 4122 compliant) — server에서 schemas 검증 통과용 */
function uuidv4(): string {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (
      Number(c) ^
      (crypto.getRandomValues(new Uint8Array(1))[0]! & (15 >> (Number(c) / 4)))
    ).toString(16),
  );
}

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

export function ProjectTaskForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">하위 업무명</span>
        <input
          aria-label="하위 업무명"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="예: 블로그 포스팅"
        />
      </label>

      {/* 체크리스트 — 최대 10개. 완료 비율로 진행률 자동 산출 (actions.ts) */}
      <ChecklistEditor
        items={row.taskChecklist ?? []}
        onChange={(next) => setRow({ ...row, taskChecklist: next })}
      />

      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당자</span>
        <select
          aria-label="담당자"
          value={row.taskAssigneeEmail ?? ""}
          onChange={(e) => {
            const email = e.target.value;
            const found = OPERATORS.find((o) => o.email === email);
            setRow({
              ...row,
              taskAssigneeEmail: email || null,
              owner: found?.name ?? "",
            });
          }}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="">팀 공통</option>
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
          <DateInput
            aria-label="시작일"
            value={row.startDateYmd ?? ""}
            onChange={(e) =>
              setRow({ ...row, startDateYmd: e.target.value || null })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
        </label>
        <label className="block text-xs">
          <span className="mb-1 block text-muted">마감일</span>
          <DateInput
            aria-label="마감일"
            value={row.endDateYmd ?? ""}
            onChange={(e) =>
              setRow({ ...row, endDateYmd: e.target.value || null })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
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
              setRow({
                ...row,
                priority: e.target.value as ListRow["priority"],
              })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
        <span className="mb-1 block text-muted">
          진행률
          {(row.taskChecklist?.length ?? 0) > 0 && (
            <span className="ml-1 text-2xs text-vermilion">
              (체크리스트 비율 자동 산출)
            </span>
          )}
        </span>
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
            disabled={(row.taskChecklist?.length ?? 0) > 0}
            className="flex-1 accent-indigo disabled:cursor-not-allowed disabled:opacity-50"
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
                  "이 sub-task를 삭제하시겠습니까? 되돌릴 수 없습니다.",
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

type ChecklistItem = NonNullable<ListRow["taskChecklist"]>[number];

function ChecklistEditor({
  items,
  onChange,
}: {
  items: ChecklistItem[];
  onChange: (next: ChecklistItem[]) => void;
}) {
  const canAdd = items.length < CHECKLIST_MAX;
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="block text-xs">
      <div className="mb-1 flex items-baseline justify-between text-muted">
        <span>
          체크리스트 ({items.length}/{CHECKLIST_MAX})
          {items.length > 0 && (
            <span className="ml-1 text-2xs text-ink-soft">
              · 완료 {doneCount}/{items.length}
            </span>
          )}
        </span>
        <button
          type="button"
          onClick={() => {
            if (!canAdd) return;
            onChange([...items, { id: uuidv4(), text: "", done: false }]);
          }}
          disabled={!canAdd}
          className="cursor-pointer border-none bg-transparent p-0 text-2xs text-vermilion hover:text-vermilion-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          + 항목 추가
        </button>
      </div>
      {items.length === 0 ? (
        <p className="border border-dashed border-line-soft bg-cream px-2 py-2 text-2xs text-muted">
          체크리스트가 비어있습니다. 항목을 추가하면 완료 비율로 진행률이 자동
          산출됩니다.
        </p>
      ) : (
        <ul className="space-y-1">
          {items.map((item, idx) => (
            <li key={item.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                aria-label={`항목 ${idx + 1} 완료`}
                checked={item.done}
                onChange={(e) =>
                  onChange(
                    items.map((it, i) =>
                      i === idx ? { ...it, done: e.target.checked } : it,
                    ),
                  )
                }
                className="h-3.5 w-3.5 accent-vermilion"
              />
              <input
                aria-label={`항목 ${idx + 1} 텍스트`}
                value={item.text}
                onChange={(e) =>
                  onChange(
                    items.map((it, i) =>
                      i === idx ? { ...it, text: e.target.value } : it,
                    ),
                  )
                }
                maxLength={200}
                placeholder="체크 항목"
                className={`flex-1 border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white ${
                  item.done ? "text-muted line-through" : ""
                }`}
              />
              <button
                type="button"
                aria-label={`항목 ${idx + 1} 삭제`}
                onClick={() => onChange(items.filter((_, i) => i !== idx))}
                className="cursor-pointer border-none bg-transparent px-1 text-muted hover:text-vermilion"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
