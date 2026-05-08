"use client";

import { useState } from "react";
import type { ProjectImprovement } from "../patterns/ProjectPattern";

type Props = {
  improvement: ProjectImprovement;
  editing: boolean;
  onSave: (next: ProjectImprovement) => void;
  onCancel: () => void;
};

export function InspectorImprovementBody({
  improvement,
  editing,
  onSave,
  onCancel,
}: Props) {
  const [draft, setDraft] = useState<ProjectImprovement>(improvement);

  if (!editing) {
    return (
      <dl className="space-y-3 text-sm">
        <Row term="제목" desc={<span className="font-semibold">{improvement.title}</span>} />
        <Row term="PM" desc={<span>{improvement.pm}</span>} />
        <Row term="기한" desc={<span className="font-mono">{improvement.due}</span>} />
        <Row term="상태" desc={<span>{improvement.status}</span>} />
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
        <span className="mb-1 block text-muted">제목</span>
        <input
          aria-label="제목"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">PM</span>
        <input
          aria-label="PM"
          value={draft.pm}
          onChange={(e) => setDraft({ ...draft, pm: e.target.value })}
          className="w-full border border-line bg-cream px-2 py-1 text-ink"
        />
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-muted">기한</span>
        <input
          aria-label="기한"
          value={draft.due}
          onChange={(e) => setDraft({ ...draft, due: e.target.value })}
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
