"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/features/ops-weekly/actions";

const SAVE_FAILED = "저장하지 못했습니다 — 잠시 후 다시 시도하세요";

/** action 호출 + 실패 문구. 호출한 자리 아래에 error 를 보여 준다. */
export function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      try {
        const res = await fn();
        setError(res.ok ? null : res.error);
      } catch {
        // action 이 던지면(DB·네트워크) 전역 에러 화면으로 번지지 않게 행 아래에서 알린다.
        setError(SAVE_FAILED);
      }
    });
  }
  return { pending, error, run };
}
