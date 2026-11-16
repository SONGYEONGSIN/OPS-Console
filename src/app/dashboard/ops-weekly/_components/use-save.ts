"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "@/features/ops-weekly/actions";

/** action 호출 + 실패 문구. 호출한 자리 아래에 error 를 보여 준다. */
export function useSave() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function run(fn: () => Promise<ActionResult>) {
    startTransition(async () => {
      const res = await fn();
      setError(res.ok ? null : res.error);
    });
  }
  return { pending, error, run };
}
