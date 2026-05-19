"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DashWidget } from "./patterns/DashPattern";

const MAX_ITEMS = 5;
const HOVER_DELAY = 200;

/**
 * AlertsBell v2 — chrome 우측 zone에서 사용.
 * - 종 SVG 20×20 + urgent 카운트 빨강 배지
 * - 호버 200ms 후 드롭다운 미리보기 (최근 urgent/review 5건)
 * - 클릭 시 /dashboard (실시간 현황) 페이지 이동 — alerts는 1면 TriageList에 통합
 * - ESC + 외부 클릭으로 닫힘
 */
export function AlertsBell({ items }: { items: DashWidget[] }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);
  const router = useRouter();

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

  // hover timer cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  const onMouseEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_DELAY);
  };
  const onMouseLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  };

  return (
    <div
      ref={wrapRef}
      className="relative flex flex-col items-end leading-none"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <button
        type="button"
        aria-label={`알림 ${urgent.length}건`}
        onClick={(e) => {
          e.stopPropagation();
          router.push("/dashboard");
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
        {urgent.length > 0 ? (
          <span className="absolute -right-1 -top-1 bg-vermilion px-1 py-px text-2xs font-bold text-cream">
            {urgent.length}
          </span>
        ) : null}
      </button>
      <span className="mt-0.5 text-2xs font-bold uppercase tracking-[0.24em] text-chrome-muted">
        알림
      </span>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-[200] mt-2 w-[320px] border border-chrome-graphite bg-cream py-1 [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
          onClick={(e) => e.stopPropagation()}
        >
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
                    href="/dashboard"
                    onClick={() => setOpen(false)}
                    className="block px-3 py-1.5 text-sm text-ink transition-colors hover:bg-vermilion hover:text-cream"
                  >
                    {alert.label}
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
