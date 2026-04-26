"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";

/**
 * 메뉴바 — 데스크탑 전용 (≥768px). 좌측 ◆ 마커 + 우측 검색/알림/사용자.
 * 좌측 macOS 스타일 메뉴(파일/편집/...)는 placeholder로 가치 낮아 제거 (2026-04-26).
 */
export function MenuBar() {
  return (
    <div className="relative z-[100] hidden h-8 items-center border-b border-line bg-washi-raised px-3.5 md:flex">
      <div className="px-3.5 pl-1 text-[14px] font-bold text-vermilion select-none">
        ◆
      </div>

      <div className="flex-1" />

      <MenuRight />
    </div>
  );
}

function MenuRight() {
  const [userOpen, setUserOpen] = useState(false);
  const userRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (!userRef.current?.contains(e.target as Node)) setUserOpen(false);
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [userOpen]);

  return (
    <div className="flex items-center gap-4 pr-1 text-xs text-muted">
      <div className="flex min-w-[240px] cursor-text items-center gap-1.5 border border-line-soft bg-washi px-2.5 py-1">
        <svg viewBox="0 0 16 16" className="h-[11px] w-[11px]">
          <path
            d="M11 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10.5 10l3 3"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span className="text-sm text-faint">서비스, 배치, 점검 항목 검색…</span>
        <kbd className="ml-auto border border-line-soft bg-washi-raised px-1.5 py-px text-3xs text-muted">
          ⌘K
        </kbd>
      </div>

      <div className="relative inline-flex h-5 w-5 cursor-pointer items-center justify-center text-sm">
        ◎
        <span className="absolute -right-1 -top-0.5 rounded-full bg-vermilion px-1 py-px text-[8px] font-bold text-cream">
          3
        </span>
      </div>

      <div ref={userRef} className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={userOpen}
          onClick={(e) => {
            e.stopPropagation();
            setUserOpen((v) => !v);
          }}
          className="inline-flex cursor-pointer items-center gap-2 border-none bg-transparent p-0"
        >
          <span className="inline-flex h-[22px] w-[22px] items-center justify-center bg-vermilion text-xs font-bold text-cream">
            송
          </span>
          <span className="text-sm font-medium text-ink">송영석</span>
        </button>
        {userOpen && (
          <div
            role="menu"
            // 일회성: 메뉴 드롭다운 4/6 오프셋 그림자 (mockup folio-dashboard.html:291)
            className="absolute right-0 top-full z-[200] min-w-[200px] border border-line bg-cream py-1 text-ink [box-shadow:4px_6px_0_rgba(21,18,12,0.15)]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                await signOut();
              }}
              className="group grid w-full cursor-pointer grid-cols-[24px_1fr_auto] items-center gap-2.5 border-none bg-transparent px-3 pl-2 py-1.5 text-left text-[12.5px] hover:bg-vermilion hover:text-cream"
            >
              <span className="text-center text-xs text-vermilion group-hover:text-cream"></span>
              <span>로그아웃</span>
              <span className="text-2xs tracking-[0.04em] text-muted group-hover:text-cream/65">
                ⇧⌘Q
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
