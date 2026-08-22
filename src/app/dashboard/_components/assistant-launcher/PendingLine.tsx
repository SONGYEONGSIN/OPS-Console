"use client";

import { useEffect, useState } from "react";
import { elapsedLabel } from "@/features/assistant/stage-label";
import { MyeongboSprite } from "./MyeongboSprite";

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
  /** 공을 툭 차는 프레임 토글 — 기다리는 동안에만 돈다. */
  const [kicking, setKicking] = useState(false);

  useEffect(() => {
    if (since === undefined) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [since]);

  useEffect(() => {
    // 움직임을 꺼둔 사용자에겐 정지 프레임만 보여준다.
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    const t = setInterval(() => setKicking((k) => !k), 500);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="text-sm text-ink-soft">
      <span className="inline-flex items-center gap-2">
        {/* 점 세 개 대신 명보가 공을 툭툭 찬다. 점은 무엇을 기다리는지 말해주지
            않았고, 얼굴이 있으면 누가 일하고 있는지가 보인다. */}
        <span aria-hidden className="inline-flex h-4 w-4 flex-shrink-0 text-vermilion">
          <MyeongboSprite kicking={kicking} />
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
