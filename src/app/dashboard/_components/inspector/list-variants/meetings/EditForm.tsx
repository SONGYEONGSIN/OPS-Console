"use client";

import Link from "next/link";
import type { EditFormProps } from "../types";

export function MeetingEditForm({ row, onCancel }: EditFormProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink">
        회의록 편집은 전용 화면에서 진행합니다.
      </p>
      <Link
        href={`/dashboard/meetings/${row.id}`}
        className="inline-block border border-ink px-3 py-1 hover:bg-ink hover:text-cream"
      >
        편집 화면 열기
      </Link>
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
