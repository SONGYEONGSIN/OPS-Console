"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMeeting } from "@/features/meetings/actions";
import type { EditFormProps } from "../types";

export function MeetingEditForm({ row, onCancel }: EditFormProps) {
  const router = useRouter();
  const [busy, startDelete] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    if (!window.confirm("이 회의록을 삭제할까요? 되돌릴 수 없습니다.")) return;
    setError(null);
    startDelete(async () => {
      const res = await deleteMeeting(row.id);
      if (!res.ok) {
        setError(res.error ?? "삭제에 실패했습니다.");
        return;
      }
      onCancel();
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">
        회의록 내용 편집은 전용 화면에서 진행합니다.
      </p>
      <Link
        href={`/dashboard/meetings/${row.id}`}
        className="inline-block border border-ink px-3 py-1 text-sm hover:bg-ink hover:text-cream"
      >
        편집 화면 열기
      </Link>

      {error && <p className="text-xs text-vermilion">{error}</p>}

      <button
        type="button"
        disabled={busy}
        onClick={onDelete}
        className="block w-full cursor-pointer border border-vermilion bg-transparent px-3 py-1.5 text-sm text-vermilion transition-colors hover:bg-vermilion hover:text-cream disabled:opacity-50"
      >
        {busy ? "삭제 중…" : "회의록 삭제"}
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="block w-full cursor-pointer border border-line bg-transparent px-3 py-1.5 text-sm text-ink hover:bg-washi"
      >
        닫기
      </button>
    </div>
  );
}
