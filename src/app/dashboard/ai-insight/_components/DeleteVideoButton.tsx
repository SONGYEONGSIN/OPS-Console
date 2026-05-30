"use client";

import { useState, useTransition } from "react";
import { deleteInsightVideo } from "@/features/insight-videos/actions";

type Props = {
  id: string;
  onDeleted?: () => void;
};

/**
 * 인사이트 영상 삭제 버튼 — admin 전용(부모가 canDelete로 가드).
 * 파괴적 동작이라 2단계 확인(삭제 → 삭제 확인 / 취소).
 */
export function DeleteVideoButton({ id, onDeleted }: Props) {
  const [arming, setArming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await deleteInsightVideo(id);
      if (res.ok) {
        onDeleted?.();
      } else {
        setError(res.error);
        setArming(false);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      {!arming ? (
        <button
          type="button"
          onClick={() => setArming(true)}
          className="inline-flex cursor-pointer items-center justify-center rounded-md border border-vermilion bg-transparent px-3 py-2 text-sm font-medium text-vermilion transition-opacity hover:opacity-90"
        >
          삭제
        </button>
      ) : (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={confirm}
            disabled={pending}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-vermilion-deep bg-vermilion-deep px-3 py-2 text-sm font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "삭제 중…" : "삭제 확인"}
          </button>
          <button
            type="button"
            onClick={() => setArming(false)}
            disabled={pending}
            className="inline-flex cursor-pointer items-center justify-center rounded-md border border-line bg-cream px-3 py-2 text-sm text-ink transition-colors hover:bg-washi-raised disabled:opacity-50"
          >
            취소
          </button>
        </div>
      )}
      {error && <span className="text-xs text-vermilion">{error}</span>}
    </div>
  );
}
