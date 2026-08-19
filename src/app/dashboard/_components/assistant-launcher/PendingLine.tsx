"use client";

import { useEffect, useState } from "react";
import { elapsedLabel } from "@/features/assistant/stage-label";

/**
 * 답을 기다리는 동안 보이는 한 줄 — 지금 하는 일 + 경과 시간.
 *
 * 예전에는 문구 둘이 고정이었다("회사 PC로 보냈습니다…" → "지식망 문서를 읽는 중…").
 * 실제 진행과 무관해서 30~40초 동안 멈춘 것처럼 보였다.
 *
 * 문구는 폴러가 부른 도구에서 나오지만, 문서 하나를 오래 읽으면 그것도 한동안
 * 안 바뀐다. **매초 바뀌는 건 경과 시간뿐**이라 이게 살아 있다는 증거가 된다.
 * 점 세 개는 CSS 애니메이션이라 정말 도는지 알려주지 못한다.
 */
export function PendingLine({
  note,
  since,
}: {
  note: string;
  /** 없으면 경과 시간을 안 보여준다 — 아무 숫자나 지어내지 않는다. */
  since?: number;
}) {
  const [now, setNow] = useState(since ?? 0);

  useEffect(() => {
    if (since === undefined) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);

  return (
    <div className="text-sm text-ink-soft">
      <span className="inline-flex items-center gap-2">
        <span className="inline-flex h-1.5 items-center gap-1">
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:0ms]" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:150ms]" />
          <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-vermilion [animation-delay:300ms]" />
        </span>
        {note}
        {since !== undefined && (
          <span className="text-2xs tabular-nums text-muted">
            {elapsedLabel(now - since)}
          </span>
        )}
      </span>
    </div>
  );
}
