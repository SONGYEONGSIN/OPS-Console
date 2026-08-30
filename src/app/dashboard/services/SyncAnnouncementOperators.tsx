"use client";

import { useState } from "react";
import { syncAnnouncementOperators } from "@/features/announcement-services/sync-operators";
import { ModalShell } from "@/components/common/ModalShell";
import { HeaderActionButton } from "@/components/common/HeaderActionButton";

/**
 * 합격자발표 서비스에 담당자를 채운다 — 총괄장에서 이름으로 맞춰서.
 *
 * 이 표는 붙여넣기로 들어온 자료라 운영자 컬럼이 없다. 성과를 개인에 귀속하려면
 * 총괄장에서 가져와야 하는데, **전부 맞지는 않는다**(실측 57/87).
 *
 * 그래서 숫자만 주지 않고 **못 맞춘 대학을 이름으로 보여준다.** 안 보여주면
 * "다 됐다"로 읽히는데, 실제로는 그 대학들의 성과가 아무에게도 안 잡힌다.
 *
 * 누르기 전에는 돌지 않는다 — 총괄장은 SharePoint 엑셀이라 매번 읽을 이유가 없다.
 */

type Result =
  | { ok: true; matched: number; updated: number; unmatched: string[] }
  | { ok: false; error: string };

export function SyncAnnouncementOperators() {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setPending(true);
    setResult(null);
    try {
      setResult((await syncAnnouncementOperators()) as Result);
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <HeaderActionButton onClick={run} disabled={pending}>
        {pending ? "맞추는 중…" : "발표 담당자 맞추기"}
      </HeaderActionButton>

      {result && (
        <ModalShell
          title="발표 담당자 맞추기"
          size="lg"
          onClose={() => setResult(null)}
          footer={
            <button
              type="button"
              onClick={() => setResult(null)}
              className="cursor-pointer border border-line px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
            >
              닫기
            </button>
          }
        >
          {!result.ok ? (
            /* 실패 사유는 요약하지 않는다 — 왜 안 됐는지가 조치다. */
            <p className="text-xs text-vermilion">{result.error}</p>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-ink">
                대학 <b className="tabular-nums">{result.matched}</b>곳의 담당자를
                맞춰 서비스{" "}
                <b className="tabular-nums">{result.updated}</b>건에 채웠습니다.
              </p>

              {result.unmatched.length === 0 ? (
                <p className="text-xs text-muted">모두 맞췄습니다.</p>
              ) : (
                <div className="border border-line-soft bg-situation-bg p-3">
                  <p className="text-xs font-medium text-ink">
                    못 맞춘 대학 {result.unmatched.length}곳
                  </p>
                  <p className="mt-1 text-2xs text-muted">
                    총괄장에 없거나 이름이 다릅니다. 이 대학들의 발표 실적은
                    아무에게도 안 잡힙니다 — 성과 대상이라면 총괄장에 그 이름으로
                    행을 넣어 주세요.
                  </p>
                  <ul className="mt-2 space-y-0.5">
                    {result.unmatched.map((u) => (
                      <li key={u} className="text-xs text-ink-soft">
                        {u}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </ModalShell>
      )}
    </>
  );
}
