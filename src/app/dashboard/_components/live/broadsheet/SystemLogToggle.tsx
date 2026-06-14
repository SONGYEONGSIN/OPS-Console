"use client";

import { useEffect, useRef, useState } from "react";
import { logDomainClass, type ActivityLogEntry } from "./activity-log";

type Props = { entries: ActivityLogEntry[] };

/**
 * SystemLogToggle — 최근 시스템 로그 펼치기 패널.
 * 토글 클릭 시 절대배치 패널 노출, 바깥 클릭 시 닫힘.
 */
export function SystemLogToggle({ entries }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  const recent = entries.slice(0, 6);

  return (
    <span className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="inline-flex items-center gap-1.5 text-vermilion font-black whitespace-nowrap cursor-pointer hover:text-vermilion-deep"
      >
        <span className="bs-live-blink">●</span>
        <span>시스템 로그</span>
        <span
          className={`inline-block transition-transform text-[20px] leading-none -translate-y-px ${
            open ? "rotate-90" : ""
          }`}
        >
          ▸
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-2 z-50 w-[440px] border border-line bg-paper shadow-offset-sm p-3 text-left normal-case tracking-normal">
          <div className="flex items-center justify-between border-b border-line-soft pb-1 mb-2">
            <span className="text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
              최근 시스템 로그
            </span>
            <span className="text-[9px] text-faint tabular-nums">
              최근 {Math.min(entries.length, 6)}건
            </span>
          </div>
          {recent.length > 0 ? (
            <ul className="flex flex-col gap-1.5 text-[11px] font-medium text-ink-soft">
              {recent.map((e) => (
                <li key={e.id}>
                  <span className="text-faint tabular-nums mr-1.5">{e.hms}</span>
                  <span className={`font-bold ${logDomainClass(e.domain)}`}>
                    [{e.domain}]
                  </span>{" "}
                  {e.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] font-medium text-faint">활동 없음</p>
          )}
        </div>
      )}
    </span>
  );
}
