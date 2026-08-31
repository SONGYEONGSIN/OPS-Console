"use client";

import { useState } from "react";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

type Props = {
  candidates: AiTipCandidateRow[];
  onPromote: (id: string) => Promise<{ ok: boolean; error?: string }>;
  onHide: (id: string) => Promise<{ ok: boolean; error?: string }>;
};

/** 수집일을 YYYY-MM-DD로. */
function formatYmd(s: string): string {
  return s.slice(0, 10);
}

/**
 * 수집된 TIP 후보 목록 — 운영리포트의 '저장된 리포트'와 같은 톤
 * (thead + hover row + 상태 배지).
 *
 * 전에는 카드가 본 목록 **위에** 쌓여 정작 등록된 TIP을 밀어냈다. 표로 바꿔
 * 목록 아래에 두고, 행마다 등록·숨김을 결정한다.
 *
 * 후보가 없으면 렌더하지 않는다 — 평소에는 안 보이는 게 맞다.
 */
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
    <div className="flex flex-col gap-3">
      {/*
        제목과 표 사이는 ListPattern 표준(28px). 부모가 `flex flex-col gap-3` 이라
        12px 이 이미 붙으므로 `mb-4`(16px)를 더해 28px 을 만든다. `mb-7` 로 두면
        40px 이 돼 표준보다 넓다 — 우편물 발송목록에서 같은 셈을 썼다(2026-09-01).
      */}
      <header className="mb-4 flex items-baseline justify-between">
        <h3 className="text-base font-semibold text-ink">수집된 TIP 후보</h3>
        <span className="text-xs text-muted">{candidates.length}건 검토 대기</span>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
            <th className="px-3 py-2">제목</th>
            <th className="px-3 py-2">리포지터리</th>
            <th className="px-3 py-2">별</th>
            <th className="px-3 py-2">수집일</th>
            <th className="px-3 py-2">검토</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((c) => (
            <tr
              key={c.id}
              className="border-b border-line-soft align-top hover:bg-line-soft"
            >
              <td className="px-3 py-2">
                {c.draft_title ? (
                  <>
                    <p className="font-medium text-ink">{c.draft_title}</p>
                    {c.draft_summary_md && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                        {c.draft_summary_md}
                      </p>
                    )}
                  </>
                ) : (
                  // 빈칸으로 두면 왜 비었는지 모른다 — claude 초안이 없었다는 뜻이다.
                  <span className="text-xs text-muted">
                    초안 없음 — 등록 후 직접 작성
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-sm">
                <a
                  href={c.repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-vermilion underline-offset-2 hover:underline"
                >
                  {c.repo_full_name}
                </a>
                {c.repo_description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted">
                    {c.repo_description}
                  </p>
                )}
              </td>
              <td className="px-3 py-2 font-mono text-xs text-ink-soft">
                {c.stars}
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {formatYmd(c.collected_at)}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => run(c.id, onPromote)}
                    className="cursor-pointer bg-ink px-2.5 py-1 text-xs text-cream transition-colors hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    등록
                  </button>
                  <button
                    type="button"
                    disabled={busyId === c.id}
                    onClick={() => run(c.id, onHide)}
                    className="cursor-pointer bg-transparent px-2.5 py-1 text-xs text-muted transition-colors hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    숨김
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
