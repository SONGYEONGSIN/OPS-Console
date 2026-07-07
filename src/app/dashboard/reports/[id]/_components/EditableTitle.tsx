"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateReportTitle } from "@/features/reports/actions";

type Props = {
  reportId: string;
  initialTitle: string;
};

/**
 * 리포트 제목 인라인 편집 — ✎ 수정 클릭 시 input + 저장/취소.
 * 저장은 updateReportTitle 서버 액션 → router.refresh()로 서버 데이터 재반영.
 * 권한(viewer 차단)은 액션에서 강제 (ShareControls와 동일 패턴).
 */
export function EditableTitle({ reportId, initialTitle }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialTitle);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    const next = value.trim();
    if (!next) {
      setError("제목을 입력하세요");
      return;
    }
    setError(null);
    startTransition(async () => {
      const r = await updateReportTitle({ id: reportId, title: next });
      if (r.ok) {
        setEditing(false);
        router.refresh();
      } else {
        setError(r.error ?? "저장 실패");
      }
    });
  }

  function handleCancel() {
    setValue(initialTitle);
    setError(null);
    setEditing(false);
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-2">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink">
          {initialTitle}
        </h2>
        <button
          type="button"
          onClick={() => {
            setValue(initialTitle);
            setEditing(true);
          }}
          className="text-sm text-muted hover:text-vermilion"
          aria-label="제목 수정"
        >
          ✎ 수정
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={value}
          autoFocus
          maxLength={200}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSave();
            if (e.key === "Escape") handleCancel();
          }}
          className="min-w-0 flex-1 border border-line bg-cream px-2 py-1 text-2xl font-bold text-ink outline-none focus:border-vermilion"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={pending}
          className="shrink-0 border border-vermilion bg-vermilion px-3 py-1.5 text-sm text-cream hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "저장 중…" : "저장"}
        </button>
        <button
          type="button"
          onClick={handleCancel}
          disabled={pending}
          className="shrink-0 border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:border-vermilion disabled:opacity-50"
        >
          취소
        </button>
      </div>
      {error ? <p className="text-xs text-vermilion">{error}</p> : null}
    </div>
  );
}
