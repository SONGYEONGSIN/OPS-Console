"use client";

import { useRouter } from "next/navigation";
import type { ActionResult } from "@/features/ops-weekly/actions";
import { useSave } from "./use-save";

/** 결과와 상관없이 서버 상태가 바뀌었을 수 있어 늘 새로 읽는다(보고 커밋 뒤 후속 실패 포함). */
export function useWorkflow() {
  const router = useRouter();
  const save = useSave();
  function run(fn: () => Promise<ActionResult>) {
    save.run(async () => {
      try {
        return await fn();
      } finally {
        router.refresh();
      }
    });
  }
  return { pending: save.pending, message: save.error, run };
}
