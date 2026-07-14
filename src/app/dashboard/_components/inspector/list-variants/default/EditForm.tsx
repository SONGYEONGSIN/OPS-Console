"use client";

import type { Dispatch, SetStateAction } from "react";
import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  row: ListRow;
  setRow: Dispatch<SetStateAction<ListRow>>;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

export function DefaultForm({ row, setRow, onSave, onCancel }: Props) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(row);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={row.name}
          onChange={(e) => setRow({ ...row, name: e.target.value })}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">ID</span>
        <input
          aria-label="ID"
          value={row.id}
          onChange={(e) => setRow({ ...row, id: e.target.value })}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 font-mono text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당</span>
        <input
          aria-label="담당"
          value={row.owner}
          onChange={(e) => setRow({ ...row, owner: e.target.value })}
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">상태</span>
        <select
          aria-label="상태"
          value={row.status}
          onChange={(e) =>
            setRow({ ...row, status: e.target.value as ListRow["status"] })
          }
          className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
        >
          <option value="active">활성</option>
          <option value="approved">정상</option>
          <option value="review">점검중</option>
          <option value="urgent">긴급</option>
        </select>
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
    </form>
  );
}
