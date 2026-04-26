"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { services, sidebarSections } from "./_data";
import { MenuBar } from "./_components/MenuBar";
import { Sidebar } from "./_components/Sidebar";
import { Content } from "./_components/Content";
import { Inspector } from "./_components/Inspector";

/**
 * 대시보드 — design-ref/folio-dashboard.html 포팅.
 *
 * 레이아웃:
 *  ≥1280     [데스크탑 풀]    titlebar / menubar / [sidebar 240 · content · inspector 300] / statusbar
 *  1024–1279 [데스크탑 축약]  사이드바 200, 인스펙터 260
 *  768–1023  [태블릿]         인스펙터 → 우측 드로어 (toolbar의 "상세" 버튼)
 *  ≤767      [모바일]         titlebar/menubar 숨김 → appbar 노출, 사이드바·인스펙터 모두 드로어
 *
 * v1 인터랙션: 행 선택, 사이드바 그룹 토글, 탭/칩/뷰스위치, 드로어 open/close, ESC 닫기, 바디 스크롤 락, 모바일 인스펙터 아코디언
 * v2 TODO: 포커스 트랩 (Tab 순환), 스와이프 닫기, viewport ≥1024로 회전 시 자동 닫기.
 */
export default function DashboardPage() {
  const [selectedId, setSelectedId] = useState<string>("SVC-PAY-001");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inspectorOpen, setInspectorOpen] = useState(false);

  // selectedId는 항상 services의 한 ID. 매칭되지 않으면 첫 서비스로 폴백 (방어).
  const selectedService = useMemo(
    () => services.find((s) => s.id === selectedId) ?? services[0],
    [selectedId]
  );

  const closeAll = useCallback(() => {
    setSidebarOpen(false);
    setInspectorOpen(false);
  }, []);

  // 드로어 열림 시 바디 스크롤 락 + ESC 핸들러
  useEffect(() => {
    const anyOpen = sidebarOpen || inspectorOpen;
    if (!anyOpen) return;

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeAll();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [sidebarOpen, inspectorOpen, closeAll]);

  const onSelectRow = (id: string) => {
    setSelectedId(id);
    // 모바일에서는 행 선택 시 인스펙터 자동 오픈 (mockup 동작).
    // onClick은 클라이언트 이벤트 핸들러이므로 SSR 가드 불필요.
    if (window.matchMedia("(max-width: 767px)").matches) {
      setInspectorOpen(true);
    }
  };

  const scrimOpen = sidebarOpen || inspectorOpen;

  return (
    <div className="dashboard-shell relative z-10 grid h-screen grid-rows-[34px_auto_1fr_26px] max-md:grid-rows-[48px_1fr] max-md:h-auto max-md:min-h-screen">
      {/* ── Mobile App Bar (≤767) ── */}
      <AppBar
        onHamburger={() => setSidebarOpen(true)}
        onInspector={() => setInspectorOpen(true)}
        inspectorOpen={inspectorOpen}
      />

      {/* ── Title Bar (데스크탑) ── */}
      <TitleBar />

      {/* ── Menu Bar (데스크탑) ── */}
      <MenuBar />

      {/* ── Main grid ── */}
      <div className="grid grid-cols-[240px_1fr_300px] overflow-hidden max-[1279px]:grid-cols-[200px_1fr_260px] max-lg:grid-cols-[200px_1fr] max-md:grid-cols-1">
        <Sidebar
          sections={sidebarSections}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <Content
          services={services}
          selectedId={selectedId}
          onSelectRow={onSelectRow}
          onInspectorToggle={() => setInspectorOpen((o) => !o)}
          inspectorOpen={inspectorOpen}
        />
        <Inspector
          service={selectedService}
          open={inspectorOpen}
          onClose={() => setInspectorOpen(false)}
        />
      </div>

      {/* ── Status Bar ── */}
      <StatusBar />

      {/* ── Drawer scrim ── */}
      <Scrim open={scrimOpen} onClick={closeAll} />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Title bar — 데스크탑 전용 (≥768px). 모바일에선 AppBar로 대체.
   ════════════════════════════════════════════════════════════ */
function TitleBar() {
  return (
    <div className="hidden grid-cols-[auto_1fr_auto] items-center border-b border-line bg-ink px-3.5 text-cream md:grid">
      <div className="mr-4 flex gap-[7px]">
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-vermilion" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-gold" />
        <span className="h-3 w-3 rounded-full border border-cream/20 bg-sage" />
      </div>
      <div className="text-center text-[13px] font-medium tracking-[0.02em]">
        운영부 <em className="not-italic mx-1.5 text-vermilion">·</em> 운영 상황실
        <span className="ml-2 text-[12px] opacity-80">OPSROOM</span>
      </div>
      <div className="ref flex gap-3.5 text-[10px] tracking-[0.08em] opacity-75">
        <span>근무 · 2교대 · 14:00~22:00</span>
        <span>● 실시간 연결</span>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   App bar — 모바일 전용 (≤767px). 햄버거 / 알림 / 상세.
   ════════════════════════════════════════════════════════════ */
function AppBar({
  onHamburger,
  onInspector,
  inspectorOpen,
}: {
  onHamburger: () => void;
  onInspector: () => void;
  inspectorOpen: boolean;
}) {
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
        운영부 <em className="not-italic mx-0.5 text-vermilion">·</em>{" "}
        <span className="text-sm text-muted max-[479px]:hidden">OPSROOM</span>
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
      <button
        type="button"
        aria-label="상세 보기"
        aria-expanded={inspectorOpen}
        aria-controls="inspector"
        onClick={onInspector}
        className="inline-flex cursor-pointer items-center justify-center border border-line-soft bg-transparent px-2 text-md text-ink min-w-[var(--tap-min)] min-h-[var(--tap-min)]"
      >
        상세 ▸
      </button>
    </header>
  );
}

/* ════════════════════════════════════════════════════════════
   Status bar — 데스크탑/모바일 모두 표시. 모바일에선 fixed 24px.
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
   Scrim — 드로어 뒤 어둡게 깔리는 오버레이. 클릭 시 모두 닫힘.
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
