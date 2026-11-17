"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { ActionResult } from "@/features/ops-weekly/actions";
import { usePendingSaves } from "./pending-saves";

export const SAVE_FAILED = "저장하지 못했습니다 — 잠시 후 다시 시도하세요";

/**
 * action 호출 + 실패 문구. 호출한 자리 아래에 error 를 보여 준다.
 * `track` 이면 글 편집기의 자동 저장이다 — [제출완료]가 이 저장이 끝나길 기다린다.
 */
export function useSave(options: { track?: boolean } = {}) {
  const registry = usePendingSaves();
  const owner = useRef(Symbol("save"));
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  useEffect(() => {
    const id = owner.current;
    return () => {
      registry?.forget(id);
    };
  }, [registry]);

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
      if (options.track) registry?.track(owner.current, work);
      await work;
    });
  }
  return { pending, error, savedAt, run };
}
