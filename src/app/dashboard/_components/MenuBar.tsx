"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "@/features/auth/actions";
import { AlertsBell } from "./AlertsBell";
import { SearchBox } from "./SearchBox";
import { getPatternMockData } from "../_data/patterns";
import type { DashWidget } from "./patterns/DashPattern";

/**
 * 메뉴바 — 데스크탑 전용 (≥768px). 좌측 ◆ 마커 + 우측 검색/알림/사용자.
 * 좌측 macOS 스타일 메뉴(파일/편집/...)는 placeholder로 가치 낮아 제거 (2026-04-26).
 */
export function MenuBar() {
  return (
    <div className="relative z-[100] hidden h-8 grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-washi-raised px-3.5 md:grid">
      <div className="px-3.5 pl-1 text-[14px] font-bold text-vermilion select-none">
        ◆
      </div>

      <div className="w-[560px] max-w-[60vw] justify-self-center">
        <SearchBox />
      </div>

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

  const alerts = getPatternMockData("alerts", "dash") as { widgets: DashWidget[] };

  return (
    <div className="flex items-center justify-end gap-4 pr-1 text-xs text-muted">
      <AlertsBell items={alerts.widgets} />

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
