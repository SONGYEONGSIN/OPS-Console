"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { submitReport } from "@/features/ops-weekly/workflow-actions";
import { usePendingSaves } from "./pending-saves";

// 제출이 이미 커밋된 뒤의 후속 실패(전원 제출 확인 등) 문구의 머리말 — 실패로 포장하지 않는다.
export const COMMITTED_PREFIX = "제출은 끝났지만";
// action 이 던졌을 때(명단·원천 조회 실패 등) — 에러 경계로 올라가 페이지가 날아가지 않게 받는다.
export const SUBMIT_FAILED = "제출하지 못했습니다 — 잠시 후 다시 시도하세요";
// 자동 저장이 실패한 채로는 제출하지 않는다 — 저장되지 않은 글이 빠진 보고서가 나가기 때문이다.
export const SAVE_BLOCKED = "저장되지 않은 내용이 있어 제출하지 않았습니다";
export const SAVE_TIMEOUT =
  "저장이 끝나지 않아 제출하지 않았습니다 — 잠시 후 다시 시도하세요";
export const SAVE_WAITING = "저장 중인 항목을 기다리는 중…";

export function useSubmit(reportId: string | null) {
  const router = useRouter();
  const saves = usePendingSaves();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [waiting, setWaiting] = useState(false);
  // 저장을 기다리는 동안의 잠금·안내는 전환(transition) 밖에서 건다 — 비동기 전환 안의 상태는
  // 그 작업이 끝날 때까지 화면에 반영되지 않아 안내가 안 보인다.
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (reportId === null || busy) return;
    setBusy(true);
    try {
      // blur 저장이 아직 나가는 중일 수 있다 — 끝날 때까지 기다리고, 실패했으면 제출하지 않는다.
      if (saves) {
        setWaiting(saves.hasPending());
        const settled = await saves.settle();
        setWaiting(false);
        if (settled.status === "timeout") {
          setMessage(SAVE_TIMEOUT);
          return;
        }
        if (settled.status === "failed") {
          setMessage(`${SAVE_BLOCKED} — ${settled.message}`);
          return;
        }
      }
      startTransition(async () => {
        try {
          const res = await submitReport({ reportId });
          setMessage(res.ok ? null : res.error);
        } catch {
          setMessage(SUBMIT_FAILED);
        } finally {
          // 성공이든 실패든 서버 상태가 바뀌었을 수 있다(제출 뒤 후속 실패 포함).
          router.refresh();
        }
      });
    } finally {
      setBusy(false);
    }
  }
  return { pending: pending || busy, message, waiting, submit };
}
