"use client";

import { useState } from "react";
import {
  applyProposalBatch,
  rejectProposalBatch,
} from "@/features/assignments/proposal/actions";

/**
 * 제안 배치의 결정 — **적용 / 반려**(설계 §9.3).
 *
 * **반려가 기본 선택지다**(R4). 그래서 비대칭이다 — 반려는 원장을 건드리지 않아
 * 되돌릴 것이 없고, 적용은 원장을 바꾼다. 한 번 더 묻는 쪽은 적용이다.
 *
 * **행별 적용은 두지 않는다.** 원장은 하위유형마다 한 줄이라 한 줄만 적용하면
 * 수시는 김, 정시는 이가 되는데 **그게 바로 G4 가 막으려던 분할**이다(rev 4).
 * 행별로 열려면 단위가 (대학 × 업무종류)여야 하고, 그건 별도 설계다.
 */
export function ProposalDecision({ batchId }: { batchId: string }) {
  const [pending, setPending] = useState<"apply" | "reject" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const run = async (what: "apply" | "reject") => {
    setPending(what);
    setMessage(null);
    try {
      if (what === "reject") {
        const r = await rejectProposalBatch(batchId);
        setFailed(!r.ok);
        setMessage(r.ok ? "반려했습니다 — 원장은 그대로입니다" : r.error);
        return;
      }
      const r = await applyProposalBatch(batchId);
      setFailed(!r.ok);
      setMessage(
        r.ok
          ? `적용 ${r.applied}건` +
              (r.conflicted > 0 ? ` · 그 사이 바뀜 ${r.conflicted}건` : "") +
              (r.alreadyDone > 0 ? ` · 이미 같음 ${r.alreadyDone}건` : "")
          : r.error,
      );
    } finally {
      setPending(null);
      setConfirming(false);
    }
  };

  const btn =
    "cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {confirming ? (
        <>
          <span className="text-xs text-vermilion">
            원장을 바꿉니다. 적용할까요?
          </span>
          <button
            type="button"
            className={btn}
            disabled={pending !== null}
            onClick={() => run("apply")}
          >
            {pending === "apply" ? "적용 중…" : "예, 적용합니다"}
          </button>
          <button
            type="button"
            className={btn}
            disabled={pending !== null}
            onClick={() => setConfirming(false)}
          >
            취소
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className={btn}
            disabled={pending !== null}
            onClick={() => setConfirming(true)}
          >
            전체 적용
          </button>
          <button
            type="button"
            className={btn}
            disabled={pending !== null}
            onClick={() => run("reject")}
          >
            {pending === "reject" ? "반려 중…" : "반려"}
          </button>
        </>
      )}
      {message && (
        <span
          className={`text-xs ${failed ? "text-vermilion" : "text-ink-soft"}`}
        >
          {message}
        </span>
      )}
    </div>
  );
}
