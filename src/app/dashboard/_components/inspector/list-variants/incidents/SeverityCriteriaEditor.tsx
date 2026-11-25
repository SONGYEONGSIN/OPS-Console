"use client";

import { useState, useTransition } from "react";
import { ModalShell } from "@/components/common/ModalShell";
import {
  SEVERITY_VALUES,
  type IncidentSeverity,
  type SeverityCriteria,
} from "@/features/incidents/schemas";
import { updateSeverityCriteria } from "@/features/incidents/severity-criteria-actions";

type Props = {
  criteria: SeverityCriteria;
  onClose: () => void;
};

/**
 * 사고 등급 기준 편집 모달 — admin 만 연다(서버 action 이 admin 을 다시 본다).
 * 등급 이름은 고정이고 설명만 고친다. 저장하면 revalidatePath 가 툴팁 props 를 새로 그린다.
 * 이 모달은 React 트리상 EditForm `<form>` 안에 뜨므로 버튼은 전부 type="button" 이다 —
 * 아니면 저장이 바깥 사고 폼을 제출한다.
 */
export function SeverityCriteriaEditor({ criteria, onClose }: Props) {
  const [draft, setDraft] = useState<SeverityCriteria>(criteria);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function setOne(severity: IncidentSeverity, description: string) {
    setDraft((prev) => ({ ...prev, [severity]: description }));
  }

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await updateSeverityCriteria(draft);
      if (r.ok) onClose();
      else setError(r.error);
    });
  }

  return (
    <ModalShell
      title="사고 등급 기준 편집"
      onClose={onClose}
      footer={
        <>
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="border border-line bg-ink px-3 py-1.5 text-sm font-medium text-cream hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            저장
          </button>
          <button
            type="button"
            onClick={onClose}
            className="border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:border-ink hover:bg-ink hover:text-cream"
          >
            취소
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {SEVERITY_VALUES.map((v) => (
          <label key={v} className="block text-xs">
            <span className="mb-1 block text-muted">{v}</span>
            <textarea
              rows={3}
              maxLength={500}
              value={draft[v]}
              onChange={(e) => setOne(v, e.target.value)}
              className="w-full border border-line-soft bg-field-bg px-2 py-1 text-ink transition-colors focus:border-ink focus:bg-white"
            />
          </label>
        ))}
        {error && (
          <p role="alert" className="text-xs text-vermilion">
            {error}
          </p>
        )}
      </div>
    </ModalShell>
  );
}
