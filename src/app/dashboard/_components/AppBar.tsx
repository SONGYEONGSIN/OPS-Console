"use client";

import { LiveClock } from "./LiveClock";
import { useSidebarToggle } from "./sidebar-toggle-context";

/**
 * AppBar — 모바일(≤767px) 전용 상단 바.
 * 좌: 햄버거(사이드바 드로어 트리거) / 중앙: OPS Console / 우: LiveClock.
 */
export function AppBar() {
  const { open } = useSidebarToggle();

  return (
    <header
      role="banner"
      className="relative z-30 hidden h-12 items-center gap-2 border-b border-line bg-washi px-3 max-md:flex"
    >
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-controls="sidebar"
        onClick={open}
        className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-line-soft bg-transparent text-ink hover:bg-washi-raised"
      >
        <svg
          aria-hidden
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        >
          <line x1="3" y1="5" x2="15" y2="5" />
          <line x1="3" y1="9" x2="15" y2="9" />
          <line x1="3" y1="13" x2="15" y2="13" />
        </svg>
      </button>
      <div className="flex-1 text-center text-md font-semibold tracking-[0.02em]">
        OPS Console
      </div>
      <LiveClock />
    </header>
  );
}
