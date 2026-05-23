"use client";

import { useEffect, useRef } from "react";
import { SideBox } from "./SideBox";
import type { ConsoleLogEntry } from "./mock-log-pool";

type Props = { lines: ConsoleLogEntry[] };

const COLOR: Record<ConsoleLogEntry["type"], string> = {
  info: "text-console-info",
  warn: "text-console-warn",
  err: "text-console-err",
};

/** 검은 배경 mono 콘솔 — 320px height + 자동 스크롤 (새 줄 추가 시 bottom). */
export function ConsoleStream({ lines }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [lines]);

  return (
    <SideBox
      title="실시간 백그라운드 로그"
      titleRight={
        <span className="text-[10px] font-normal text-ink-muted">Auto Scroll</span>
      }
    >
      <div
        ref={ref}
        className="flex h-[320px] flex-col gap-1.5 overflow-y-auto border border-ink bg-console-bg p-3 font-mono text-xs text-console-fg"
      >
        {lines.map((l, i) => (
          <div key={i} data-console-line className={`leading-[1.5] ${COLOR[l.type]}`}>
            {l.text}
          </div>
        ))}
      </div>
    </SideBox>
  );
}
