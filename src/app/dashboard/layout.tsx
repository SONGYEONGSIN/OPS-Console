"use client";

import { useCallback, useEffect, useState } from "react";
import { sidebarSections } from "./_data";
import { LiveClock } from "./_components/LiveClock";
import { MenuBar } from "./_components/MenuBar";
import { Sidebar } from "./_components/Sidebar";

/**
 * dashboard 셸 — 모든 /dashboard 하위 라우트 공통.
 * - TitleBar (데스크탑) / AppBar (모바일) / MenuBar (데스크탑) / Sidebar (drawer) / StatusBar / Scrim (sidebar drawer용)
 * - children: 페이지 본체 (Content + Inspector 또는 패턴 컴포넌트)
 * - sidebarOpen state는 layout이 보유 (모든 dashboard 페이지 공유)
 * - inspectorOpen state는 페이지가 자체 보유 (패턴별 ON/OFF)
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // sidebar drawer 열림 시 바디 스크롤 락 + ESC 닫기
  useEffect(() => {
    if (!sidebarOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen]);

  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="dashboard-shell relative z-10 grid h-screen grid-rows-[34px_auto_1fr_26px] max-md:grid-rows-[48px_1fr] max-md:h-auto max-md:min-h-screen">
      <AppBar onHamburger={() => setSidebarOpen(true)} />
      <TitleBar />
      <MenuBar />

      <div className="grid grid-cols-[240px_1fr] overflow-hidden max-[1279px]:grid-cols-[200px_1fr] max-md:grid-cols-1">
        <Sidebar
          sections={sidebarSections}
          open={sidebarOpen}
          onClose={closeSidebar}
        />
        <div className="min-h-0 overflow-y-auto">{children}</div>
      </div>

      <StatusBar />
      <Scrim open={sidebarOpen} onClick={closeSidebar} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Title bar — 데스크탑 전용 (≥768px)
   ════════════════════════════════════════════════════════════ */
function TitleBar() {
  return (
    <div className="hidden grid-cols-[1fr_auto_1fr] items-center border-b border-line bg-ink px-3.5 text-cream md:grid">
      <div />
      <div className="text-center text-[13px] font-medium tracking-[0.02em]">
        운영부 <em className="not-italic mx-1.5 text-vermilion">·</em> 상황실
      </div>
      <div className="flex justify-end">
        <LiveClock />
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   App bar — 모바일 전용 (≤767px). 햄버거/알림/연결 LED.
   "상세" 버튼은 일단 시각만 — onClick no-op (회귀 후 결정).
   ════════════════════════════════════════════════════════════ */
function AppBar({ onHamburger }: { onHamburger: () => void }) {
  return (
    <header
      role="banner"
      className="relative z-30 hidden h-12 items-center gap-2 border-b border-line bg-washi px-3 max-md:flex"
    >
      <button
        type="button"
        aria-label="메뉴 열기"
        aria-controls="sidebar"
        onClick={onHamburger}
        className="inline-flex cursor-pointer items-center justify-center border border-line-soft bg-transparent px-2 text-md text-ink min-w-[var(--tap-min)] min-h-[var(--tap-min)]"
      >
        ☰
      </button>
      <div className="flex-1 text-center text-md font-semibold tracking-[0.02em]">
        운영부 <em className="not-italic mx-0.5 text-vermilion">·</em> 상황실
      </div>
      <button
        type="button"
        aria-label="알림 3건"
        className="inline-flex cursor-pointer items-center justify-center border border-line-soft bg-transparent px-2 text-md text-ink min-w-[var(--tap-min)] min-h-[var(--tap-min)]"
      >
        ✉<sup className="ml-0.5 text-xs text-vermilion">3</sup>
      </button>
      <span
        role="status"
        aria-label="연결됨"
        className="h-2 w-2 rounded-full bg-sage [box-shadow:var(--shadow-led-sage-strong)]"
      />
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   Status bar — 기존 코드 그대로 (page.tsx에서 옮김)
   ════════════════════════════════════════════════════════════ */
function StatusBar() {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] items-center gap-5 border-t border-line bg-ink px-4 text-2xs tracking-[0.08em] text-cream max-md:fixed max-md:bottom-0 max-md:left-0 max-md:right-0 max-md:z-[25] max-md:h-6 max-md:px-3 max-md:text-xs">
      <div className="flex items-center gap-[18px] max-md:gap-3">
        <span className="opacity-75">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-sage align-middle [box-shadow:var(--shadow-led-sage)]" />
          <span className="text-xs tracking-normal">연결됨</span>
        </span>
        <span className="opacity-75 max-md:hidden">
          <strong className="font-medium opacity-100">브랜치</strong> main
        </span>
        <span className="opacity-75">
          <strong className="font-medium opacity-100">
            <span className="text-xs tracking-normal">동기화</span>
          </strong>{" "}
          <span className="text-xs tracking-normal">12초 전</span>
        </span>
      </div>
      <div className="flex items-center justify-center gap-[18px] max-md:hidden">
        <span className="opacity-75">
          <span className="text-xs tracking-normal">
            MS-2026-042 · 14,280 단어 · 47페이지 · 한/영
          </span>
        </span>
      </div>
      <div className="flex items-center justify-end gap-[18px] max-md:gap-3">
        <span className="opacity-75 max-md:hidden">
          <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-vermilion align-middle [box-shadow:var(--shadow-led-vermilion)]" />
          <span className="text-xs tracking-normal">알림 3건</span>
        </span>
        <span className="opacity-75 max-md:hidden">
          <strong className="font-medium opacity-100">줄</strong> 214:32
        </span>
        <span className="opacity-75 max-md:hidden">UTF-8</span>
        <span className="opacity-75">v 4.2.1</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Scrim — sidebar drawer 뒤 오버레이
   ════════════════════════════════════════════════════════════ */
function Scrim({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      aria-hidden
      className={`fixed inset-0 z-[35] bg-ink/35 transition-opacity duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
        open ? "block opacity-100" : "pointer-events-none hidden opacity-0"
      }`}
    />
  );
}
