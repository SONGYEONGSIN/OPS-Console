"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteProposalDoc } from "@/features/knowledge/actions";

/**
 * 제안 초안 삭제 버튼 — 볼트에서 화면이 여는 유일한 쓰기 동작.
 *
 * 열람 화면은 읽기 전용이 원칙이다. 여기만 예외인 이유는 **에이전트 초안이 쌓이는데
 * 치울 길이 화면에 없었기** 때문이다. 사람이 쓴 지식은 계속 옵시디언에서 지운다.
 *
 * 되돌릴 수 없으므로 한 번 더 묻는다 — 파일 경로를 그대로 보여주고 확인받는다.
 */
export function ProposalDelete({
  path,
  title,
}: {
  path: string;
  title: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <div className="mt-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setConfirming(true);
          }}
          className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
        >
          초안 삭제
        </button>
        {error && <p className="mt-2 text-xs text-vermilion-deep">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 border border-vermilion-deep bg-situation-bg p-3">
      <p className="text-xs text-ink">
        <b>{title}</b> 초안을 지웁니다.
      </p>
      <p className="mt-1 font-mono text-2xs text-muted">{path}</p>
      <p className="mt-2 text-xs text-vermilion-deep">
        볼트 파일이 실제로 삭제됩니다 — <b>되돌릴 수 없습니다.</b>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await deleteProposalDoc(path);
              if (r.ok) {
                setConfirming(false);
                // 목록으로 — 방금 지운 문서를 계속 열어두면 없는 걸 보고 있게 된다.
                router.push("/dashboard/knowledge");
                router.refresh();
                return;
              }
              // 실패 이유를 그대로 보여준다. 요약하면 왜 안 됐는지 알 수 없다.
              setError(r.error);
              setConfirming(false);
            })
          }
          className="cursor-pointer border border-vermilion-deep bg-vermilion-deep px-3 py-1 text-xs font-medium text-cream transition-colors hover:bg-vermilion disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "지우는 중…" : "삭제"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
        >
          취소
        </button>
      </div>
    </div>
  );
}
