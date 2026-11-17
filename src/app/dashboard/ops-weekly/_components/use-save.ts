"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/features/ops-weekly/actions";
import { usePendingSaves } from "./pending-saves";

export const SAVE_FAILED = "저장하지 못했습니다 — 잠시 후 다시 시도하세요";

/**
 * action 호출 + 실패 문구. 호출한 자리 아래에 error 를 보여 준다.
 * `track` 이면 글 편집기의 자동 저장이다 — [제출완료]가 이 저장이 끝나길 기다린다.
 * key 는 저장하는 **데이터**의 키(편집기 인스턴스가 아니다), label 은 실패했을 때 사용자에게 보일 이름.
 */
export function useSave(
  options: { track?: { key: string; label: string } } = {},
) {
  const registry = usePendingSaves();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const work = (async (): Promise<string | null> => {
        try {
          const res = await fn();
          setError(res.ok ? null : res.error);
          if (res.ok) setSavedAt(new Date().toISOString());
          return res.ok ? null : res.error;
        } catch {
          // action 이 던지면(DB·네트워크) 전역 에러 화면으로 번지지 않게 행 아래에서 알린다.
          setError(SAVE_FAILED);
          return SAVE_FAILED;
        }
      })();
      if (options.track) {
        registry?.track(options.track.key, options.track.label, work);
      }
      await work;
    });
  }
  return { pending, error, savedAt, run };
}
