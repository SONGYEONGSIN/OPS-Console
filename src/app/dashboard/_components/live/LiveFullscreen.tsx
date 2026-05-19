"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ScopeToggle } from "./ScopeToggle";

type Props = {
  mine: boolean;
  title: string;
  children: ReactNode;
};

/**
 * LiveFullscreen — 실시간 현황 전용 풀스크린 wrapper.
 * 진입 시 자동 fullscreen=true → fixed inset-0 z-[100] overlay가 chrome 위 덮어쓰기.
 * X 버튼 클릭 시 fullscreen=false → 일반 div로 전환 (chrome 노출).
 * ESC 키도 동일 동작.
 */
export function LiveFullscreen({ mine, title, children }: Props) {
  const [fullscreen, setFullscreen] = useState(true);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [fullscreen]);

  const inner = (
    <>
      <header className="flex items-center justify-between border-b border-line bg-cream px-6 py-3">
        <div className="flex items-baseline gap-3">
          <h1 className="text-md font-semibold tracking-[-0.01em] text-ink">
            {title}
          </h1>
          <span className="font-mono text-2xs uppercase tracking-[0.18em] text-vermilion">
            ● LIVE
          </span>
        </div>
        <div className="flex items-center gap-3">
          <ScopeToggle mine={mine} />
          <button
            type="button"
            aria-label="닫기"
            onClick={() => setFullscreen(false)}
            className="cursor-pointer border border-line bg-transparent px-2 py-1 text-sm text-ink hover:border-vermilion hover:text-vermilion"
          >
            ×
          </button>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto bg-washi-raised px-6 py-6">
        {children}
      </div>
    </>
  );

  if (fullscreen) {
    return (
      <div
        data-testid="live-fullscreen-overlay"
        className="fixed inset-0 z-[100] flex flex-col bg-cream"
      >
        {inner}
      </div>
    );
  }

  return <div className="flex h-full flex-col">{inner}</div>;
}
