"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { promoteProposalDoc } from "@/features/knowledge/actions";
import { CATEGORY_ORDER } from "@/features/knowledge/shared";

/**
 * 검토를 마친 초안을 본 위치로 옮기는 버튼.
 *
 * 지금까지는 채팅(`promote_doc`)으로만 됐다. 그런데 **읽고 바로 결정하는 자리는
 * 이 화면**이라, 옮기는 동작만 다른 창에 있으면 검토하러 온 사람이 매번 옮겨
 * 다녀야 했다. 폴러가 꺼져 있어도 되는 건 덤이다 — 서버가 Graph 로 직접 옮긴다.
 *
 * 되돌리기가 번거로우므로 한 번 더 묻는다. 본 위치는 여럿이 함께 쓰는 파일이다.
 */
export function ProposalPromote({
  path,
  title,
  category,
}: {
  path: string;
  title: string;
  /** 초안이 선언한 분류. 그대로 그 폴더로 간다. */
  category: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const known = CATEGORY_ORDER.includes(
    category as (typeof CATEGORY_ORDER)[number],
  );
  if (!known) {
    // 눌러서 실패를 보느니 무엇을 고쳐야 하는지 먼저 말한다.
    return (
      <p className="mt-3 border border-line-soft bg-washi px-3 py-2 text-xs text-ink-soft">
        옮길 자리를 모릅니다 — 이 초안의 <b>분류</b>가 볼트에 없는 값(
        <span className="font-mono">{category || "없음"}</span>)입니다. 옵시디언에서
        frontmatter 의 <span className="font-mono">category</span> 를 고친 뒤 다시
        오세요.
      </p>
    );
  }

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
          지식망 옮기기
        </button>
        {/* 어디로 가는지 먼저 보여준다 — 누르고 나서 알면 늦다. */}
        <span className="ml-2 font-mono text-2xs text-muted">
          {category}/ 로
        </span>
        {error && <p className="mt-2 text-xs text-vermilion-deep">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mt-3 border border-line bg-situation-bg p-3">
      <p className="text-xs text-ink">
        <b>{title}</b> 을(를) <b>{category}</b> 로 옮깁니다.
      </p>
      <p className="mt-1 font-mono text-2xs text-muted">
        {path} → {category}/
      </p>
      <p className="mt-1 text-2xs text-muted">
        본 위치는 여럿이 함께 쓰는 자리입니다. 내용을 확인했는지 다시 한 번 보세요.
      </p>

      <div className="mt-2 flex gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const r = await promoteProposalDoc(path);
              if (!r.ok) {
                setError(r.error);
                setConfirming(false);
                return;
              }
              // 지금 보던 경로는 이제 없다 — 새 자리로 보낸다.
              router.push(
                `/dashboard/knowledge?doc=${encodeURIComponent(r.toPath)}`,
              );
              router.refresh();
            })
          }
          className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pending ? "옮기는 중…" : "옮기기"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="cursor-pointer border border-line-soft px-3 py-1 text-xs text-ink-soft transition-colors hover:border-ink hover:bg-ink hover:text-cream disabled:cursor-not-allowed disabled:opacity-40"
        >
          취소
        </button>
      </div>
    </div>
  );
}
