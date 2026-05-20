"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { OpsAlert } from "@/features/alerts/queries";

const MAX_ITEMS = 8;

const TONE_DOT: Record<OpsAlert["tone"], string> = {
  urgent: "bg-vermilion",
  review: "bg-ink",
  ok: "bg-sage",
};

/**
 * AlertsBell — chrome 우측 종 아이콘.
 * - urgent 카운트 빨강 배지
 * - 클릭 시 드롭다운 토글 (실 데이터 알림 목록)
 * - 각 알림 클릭 → 해당 도메인 페이지로 이동
 * - ESC / 외부 클릭으로 닫힘
 */
export function AlertsBell({ items }: { items: OpsAlert[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 배지 = 전체 신규 알림 수 (urgent만이 아니라 새 액션건 전체)
  const badgeCount = items.length;
  const urgentCount = useMemo(
    () => items.filter((i) => i.tone === "urgent").length,
    [items],
  );
  const visible = items.slice(0, MAX_ITEMS);

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
    <div ref={wrapRef} className="relative flex flex-col items-end leading-none">
      <button
        type="button"
        aria-label={`알림 ${badgeCount}건`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center border-none bg-transparent p-0"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-5 w-5 stroke-chrome-graphite"
          fill="none"
          strokeWidth="1.5"
        >
          <path d="M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9z" />
          <path d="M10 21a2 2 0 004 0" />
        </svg>
        {badgeCount > 0 ? (
          <span className="absolute -right-1 -top-1 bg-vermilion px-1 py-px text-2xs font-bold text-cream">
            {badgeCount}
          </span>
        ) : null}
      </button>
      <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.24em] text-chrome-muted">
        알림
      </span>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 w-[340px] border border-chrome-graphite bg-cream py-1 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="border-b border-line-soft px-3 py-1.5 text-2xs uppercase tracking-[0.18em] text-vermilion">
            알림 {badgeCount}건 · 긴급 {urgentCount}건
          </div>
          {visible.length === 0 ? (
            <p className="px-3 py-3 text-xs text-muted">새 알림 없음</p>
          ) : (
            <ul role="listbox" className="flex max-h-[60vh] flex-col overflow-y-auto">
              {visible.map((alert) => (
                <li key={alert.id}>
                  <Link
                    href={alert.href}
                    onClick={() => setOpen(false)}
                    className="grid grid-cols-[8px_1fr_auto] items-center gap-2 px-3 py-2 text-xs transition-colors hover:bg-washi-raised"
                  >
                    <span
                      aria-hidden
                      className={`h-1.5 w-1.5 self-center ${TONE_DOT[alert.tone]}`}
                    />
                    <span className="min-w-0">
                      <span className="block text-2xs text-muted">
                        {alert.category}
                      </span>
                      <span className="block truncate text-ink">
                        {alert.label}
                      </span>
                    </span>
                    <span className="shrink-0 text-2xs text-muted">
                      {alert.time}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
