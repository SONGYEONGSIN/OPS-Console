"use client";

import { useState } from "react";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

type Props = {
  candidates: AiTipCandidateRow[];
  onPromote: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onHide: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

/** 수집된 후보 검토 패널. 후보가 없으면 렌더하지 않는다. */
export function TipCandidatePanel({ candidates, onPromote, onHide }: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  if (candidates.length === 0) return null;

  const run = async (
    id: string,
    fn: (id: string) => Promise<{ ok: boolean; error?: string }>,
  ) => {
    setBusyId(id);
    try {
      const res = await fn(id);
      if (!res.ok) window.alert(res.error ?? "처리에 실패했습니다.");
    } catch {
      // 세션 만료·타임아웃 등 액션 자체가 throw하는 경우 — 버튼이 영구히
      // 잠기지 않도록 finally에서 busyId를 반드시 해제한다.
      window.alert("처리 중 오류가 발생했습니다.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mb-4 border border-line-soft bg-situation-bg p-3">
      <h2 className="mb-2 text-sm font-medium text-ink">
        수집된 후보 {candidates.length}건
      </h2>
      <ul className="space-y-2">
        {candidates.map((c) => (
          <li
            key={c.id}
            className="border border-line-soft bg-paper p-2 text-xs"
          >
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={c.repo_url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-vermilion hover:underline"
              >
                {c.repo_full_name}
              </a>
              <span className="text-muted">★ {c.stars}</span>
            </div>
            {c.repo_description && (
              <p className="mt-1 text-muted">{c.repo_description}</p>
            )}
            {c.draft_title ? (
              <div className="mt-2">
                <p className="font-medium text-ink">{c.draft_title}</p>
                {c.draft_summary_md && (
                  <p className="mt-1 whitespace-pre-wrap text-ink-soft">
                    {c.draft_summary_md}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-muted">
                초안 없음 — 등록 후 직접 작성하세요
              </p>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => run(c.id, onPromote)}
                className="border border-line bg-ink px-2 py-1 text-cream hover:bg-ink/90 disabled:opacity-50"
              >
                TIP으로 등록
              </button>
              <button
                type="button"
                disabled={busyId === c.id}
                onClick={() => run(c.id, onHide)}
                className="border border-line bg-transparent px-2 py-1 text-ink hover:bg-line-soft disabled:opacity-50"
              >
                숨김
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
