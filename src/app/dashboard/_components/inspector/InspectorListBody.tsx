"use client";

import { useState } from "react";
import type { ListRow } from "../patterns/ListPattern";

type Props = {
  row: ListRow;
  editing: boolean;
  onSave: (next: ListRow) => void;
  onCancel: () => void;
};

export function InspectorListBody({ row, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<ListRow>(row);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="ID" desc={<span className="font-mono">{row.id}</span>} />
        <Row term="이름" desc={<span className="font-semibold">{row.name}</span>} />
        <Row term="상태" desc={<span>{row.status}</span>} />
        <Row term="담당" desc={<span>{row.owner}</span>} />
      </dl>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(draft);
      }}
      className="space-y-3"
    >
      <label className="block text-xs">
        <span className="mb-1 block text-muted">이름</span>
        <input
          aria-label="이름"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">담당</span>
        <input
          aria-label="담당"
          value={draft.owner}
          onChange={(e) => setDraft({ ...draft, owner: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          className="flex-1 border border-line bg-vermilion px-3 py-1.5 text-sm font-medium text-cream hover:bg-vermilion-deep"
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

function Row({ term, desc }: { term: string; desc: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_1fr] gap-x-3">
      <dt className="text-xs text-muted">{term}</dt>
      <dd>{desc}</dd>
    </div>
  );
}
