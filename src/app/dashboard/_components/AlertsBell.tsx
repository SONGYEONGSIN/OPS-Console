"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DashWidget } from "./patterns/DashPattern";

const MAX_ITEMS = 5;

/**
 * AlertsBell — MenuBar 우측 ◎ 클릭 → 인라인 드롭다운으로 최근 알림 노출.
 * urgent + review 톤만 추려 표시. 항목 클릭 시 /dashboard/alerts로 이동.
 * - ESC + 외부 클릭으로 닫힘
 * - urgent 카운트만 빨간 배지로 표시 (전체가 아닌 "지금 봐야 할 것")
 */
export function AlertsBell({ items }: { items: DashWidget[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const urgent = useMemo(
    () => items.filter((i) => i.tone === "urgent"),
    [items],
  );
  const visible = useMemo(
    () => items.filter((i) => i.tone !== "ok").slice(0, MAX_ITEMS),
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("click", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-label={`알림 ${urgent.length}건`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent text-sm text-muted"
      >
        ◎
        {urgent.length > 0 ? (
          <span className="absolute -right-1 -top-0.5 rounded-full bg-vermilion px-1 py-px text-[8px] font-bold text-cream">
            {urgent.length}
          </span>
        ) : null}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[200] mt-1 w-[320px] border border-line bg-cream py-1 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]">
          <div className="border-b border-line-soft px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-vermilion">
            알림 · {urgent.length}건 긴급
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">새 알림 없음</p>
          ) : (
            <ul role="listbox" className="flex flex-col">
              {visible.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href="/dashboard/alerts"
                    onClick={() => setOpen(false)}
                    className="grid grid-cols-[10px_1fr_auto_auto] items-baseline gap-2 px-3 py-1.5 text-sm text-ink transition-colors hover:bg-vermilion hover:text-cream"
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 self-center ${
                        alert.tone === "urgent" ? "bg-vermilion" : "bg-gold"
                      }`}
                    />
                    <span className="truncate">{alert.label}</span>
                    <span className="font-mono text-2xs font-semibold tracking-tight">
                      {alert.value}
                    </span>
                    <span className="font-mono text-2xs uppercase tracking-[0.06em] text-muted">
                      {alert.time}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link
            href="/dashboard/alerts"
            onClick={() => setOpen(false)}
            className="block border-t border-line-soft px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-muted hover:text-vermilion"
          >
            전체 알림 보기 →
          </Link>
        </div>
      )}
    </div>
  );
}
