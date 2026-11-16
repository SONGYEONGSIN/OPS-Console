"use client";

import { useRouter } from "next/navigation";
import type { ActionResult } from "@/features/ops-weekly/actions";
import { useSave } from "./use-save";

/** 설정 저장 — 결과와 상관없이 서버 값이 바뀌었을 수 있어 늘 새로 읽는다. */
export function useSettingsSave() {
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
  return { pending: save.pending, error: save.error, run };
}
