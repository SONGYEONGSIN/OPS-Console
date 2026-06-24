"use client";

import type { EditFormProps } from "../types";
import { QUOTE_STATUS_LABEL, type QuoteStatus } from "@/features/quotes/schemas";

const STATUS_OPTIONS = Object.entries(QUOTE_STATUS_LABEL) as [
  keyof typeof QUOTE_STATUS_LABEL,
  string,
][];

export function QuoteEditForm({ row, setRow, onSave, onCancel }: EditFormProps) {
  const isNew = !row.id;

  function handleDelete() {
    if (!window.confirm("이 견적서를 삭제하시겠습니까?")) return;
    onSave({ ...row, status: "deleted" });
  }

  return (
    <form
      className="flex flex-col gap-4 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
    >
      {/* 고객 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">고객</span>
        <input
          type="text"
          value={row.quoteCustomer ?? ""}
          onChange={(e) => setRow({ ...row, quoteCustomer: e.target.value })}
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
          placeholder="고객명"
        />
      </label>

      {/* 견적일 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">견적일</span>
        <input
          type="date"
          value={row.quoteDate ?? ""}
          onChange={(e) => setRow({ ...row, quoteDate: e.target.value })}
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </label>

      {/* 금액 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">금액 (원)</span>
        <input
          type="number"
          min={0}
          step={1}
          value={row.quoteAmount ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              quoteAmount: e.target.value === "" ? null : Number(e.target.value),
            })
          }
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
          placeholder="0"
        />
      </label>

      {/* 담당 (owner email) */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">담당 (이메일)</span>
        <input
          type="email"
          value={row.quoteOwner ?? ""}
          onChange={(e) => setRow({ ...row, quoteOwner: e.target.value })}
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
          placeholder="operator@example.com"
        />
      </label>

      {/* 상태 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">상태</span>
        <select
          value={row.quoteStatus ?? "draft"}
          onChange={(e) =>
            setRow({
              ...row,
              quoteStatus: e.target.value as QuoteStatus,
            })
          }
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
        >
          {STATUS_OPTIONS.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {/* 유효기간 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">유효기간</span>
        <input
          type="date"
          value={row.quoteValidUntil ?? ""}
          onChange={(e) =>
            setRow({
              ...row,
              quoteValidUntil: e.target.value === "" ? null : e.target.value,
            })
          }
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
        />
      </label>

      {/* 비고 */}
      <label className="flex flex-col gap-1">
        <span className="text-xs text-muted">비고</span>
        <textarea
          rows={3}
          value={row.quoteNote ?? ""}
          onChange={(e) =>
            setRow({ ...row, quoteNote: e.target.value || null })
          }
          className="rounded border border-line px-3 py-1.5 text-sm text-ink focus:border-ink focus:outline-none"
          placeholder="메모"
        />
      </label>

      {/* 버튼 */}
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
      {!isNew && (
        <div className="border-t border-line-soft pt-3">
          <button
            type="button"
            onClick={handleDelete}
            className="w-full border border-vermilion-deep bg-transparent px-3 py-1.5 text-sm text-vermilion-deep hover:bg-vermilion-deep hover:text-cream"
          >
            삭제
          </button>
        </div>
      )}
    </form>
  );
}
