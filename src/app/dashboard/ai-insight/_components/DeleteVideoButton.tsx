"use client";

import { useState, useTransition } from "react";
import { deleteInsightVideo } from "@/features/insight-videos/actions";

type Props = {
  id: string;
  onDeleted?: () => void;
};

const CONFIRM_MESSAGE =
  "이 영상을 삭제할까요?\n삭제하면 다음 수집에서도 다시 가져오지 않습니다.";

/**
 * 인사이트 영상 삭제 버튼 — admin 전용(부모가 canDelete로 가드).
 * 클릭 시 브라우저 confirm으로 한 번 확인받고, 확인하면 즉시 삭제한다.
 */
export function DeleteVideoButton({ id, onDeleted }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleClick() {
    if (!window.confirm(CONFIRM_MESSAGE)) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteInsightVideo(id);
      if (res.ok) {
        onDeleted?.();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="inline-flex cursor-pointer items-center justify-center border border-vermilion bg-transparent px-3 py-2 text-sm font-medium text-vermilion transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "삭제 중…" : "삭제"}
      </button>
      {error && <span className="text-xs text-vermilion">{error}</span>}
    </div>
  );
}
