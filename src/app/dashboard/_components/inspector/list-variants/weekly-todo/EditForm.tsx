"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";
import { DateInput } from "@/components/common/DateInput";

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

const CATEGORY_OPTIONS = [
  "원서접수",
  "문서작성",
  "회의/일정",
  "외부미팅",
  "사고대응",
  "계약/백업",
  "온보딩/교육",
  "AI 활용",
  "기타",
] as const;

const CUSTOM_CATEGORY = "기타";

function isPresetCategory(c: string | null | undefined): boolean {
  if (!c) return false;
  return (CATEGORY_OPTIONS as readonly string[]).includes(c);
}

/** ISO → KST 'YYYY-MM-DD' (date input 값). */
function isoToKstDate(iso?: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(
    new Date(iso),
  );
}

/** ISO → KST 'HH:mm' 24h (time input 값). */
function isoToKstTime(iso?: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

/** date(YYYY-MM-DD KST) + time(HH:mm) → ISO 8601 Z. time 비어있으면 00:00. */
function combineKstToIso(date: string, time: string): string {
  if (!date) return "";
  const t = time || "00:00";
  return new Date(`${date}T${t}:00+09:00`).toISOString();
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
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
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          placeholder="설명 (선택)"
        />
      </label>
      <div className="space-y-1.5">
        <label className="block text-xs">
          <span className="mb-1 block text-muted">카테고리</span>
          <select
            aria-label="카테고리"
            value={
              row.category && isPresetCategory(row.category)
                ? row.category
                : row.category
                  ? CUSTOM_CATEGORY
                  : ""
            }
            onChange={(e) => {
              const v = e.target.value;
              if (v === "") setRow({ ...row, category: undefined });
              else if (v === CUSTOM_CATEGORY)
                // 기타 선택 시 — 기존 임의 값 유지하거나 빈 문자열로 시작
                setRow({
                  ...row,
                  category:
                    row.category && !isPresetCategory(row.category)
                      ? row.category
                      : "",
                });
              else setRow({ ...row, category: v });
            }}
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
          >
            <option value="">선택 안 함</option>
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </label>
        {row.category != null && !isPresetCategory(row.category) ? (
          <input
            aria-label="카테고리 직접 입력"
            value={row.category}
            onChange={(e) => setRow({ ...row, category: e.target.value })}
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
            placeholder="기타 카테고리명 직접 입력"
          />
        ) : null}
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
        <span className="mb-1 block text-muted">마감일시 (KST)</span>
        <div className="grid grid-cols-2 gap-2">
          <DateInput
            aria-label="마감일"
            value={isoToKstDate(row.dueAt)}
            onChange={(e) =>
              setRow({
                ...row,
                dueAt: e.target.value
                  ? combineKstToIso(e.target.value, isoToKstTime(row.dueAt))
                  : null,
              })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
          <input
            type="time"
            aria-label="마감 시각"
            value={isoToKstTime(row.dueAt)}
            onChange={(e) =>
              setRow({
                ...row,
                dueAt:
                  combineKstToIso(isoToKstDate(row.dueAt), e.target.value) ||
                  null,
              })
            }
            className="w-full border border-line-soft bg-field-bg px-2 py-1 text-xs text-ink transition-colors focus:border-ink focus:bg-white"
          />
        </div>
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
