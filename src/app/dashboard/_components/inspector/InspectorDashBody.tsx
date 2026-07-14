"use client";

import { useState } from "react";
import type { DashWidget } from "../patterns/DashPattern";

type Props = {
  widget: DashWidget;
  editing: boolean;
  onSave: (next: DashWidget) => void;
  onCancel: () => void;
};

export function InspectorDashBody({ widget, editing, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<DashWidget>(widget);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="라벨" desc={<span className="font-semibold">{widget.label}</span>} />
        <Row term="값" desc={<span>{widget.value}</span>} />
        <Row term="시각" desc={<span className="font-mono">{widget.time}</span>} />
        <Row term="톤" desc={<span>{widget.tone}</span>} />
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
        <span className="mb-1 block text-muted">라벨</span>
        <input
          aria-label="라벨"
          value={draft.label}
          onChange={(e) => setDraft({ ...draft, label: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">값</span>
        <input
          aria-label="값"
          value={draft.value}
          onChange={(e) => setDraft({ ...draft, value: e.target.value })}
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
          className="flex-1 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-line-soft"
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
