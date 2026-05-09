"use client";

import { useCallback, useEffect, useState } from "react";
import { sidebarSections } from "../_data";
import { OpenTabsProvider } from "./page-header/open-tabs-context";
import { Sidebar } from "./Sidebar";

/**
 * DashboardShell — dashboard 클라이언트 wrapper.
 * sidebar drawer state + ESC + body scroll lock + Scrim 만 담당.
 * topBar / chrome / appBar / statusBar / children 은 server에서 props로 주입.
 */
export function DashboardShell({
  topBar,
  chrome,
  appBar,
  statusBar,
  children,
}: {
  topBar?: React.ReactNode;
  chrome: React.ReactNode;
  appBar: React.ReactNode;
  statusBar: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    <OpenTabsProvider>
      <div className="dashboard-shell relative z-10 grid h-screen grid-rows-[34px_52px_1fr_26px] max-md:grid-rows-[34px_48px_1fr] max-md:h-auto max-md:min-h-screen">
        {topBar}
        {appBar}
        {chrome}
        <div className="grid grid-cols-[240px_1fr] overflow-hidden max-[1279px]:grid-cols-[200px_1fr] max-md:grid-cols-1">
          <Sidebar sections={sidebarSections} open={sidebarOpen} onClose={closeSidebar} />
          <div className="min-h-0 overflow-y-auto bg-cream">{children}</div>
        </div>
        {statusBar}
        <div
          onClick={closeSidebar}
          aria-hidden
          className={`fixed inset-0 z-[35] bg-ink/35 transition-opacity duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${
            sidebarOpen ? "block opacity-100" : "pointer-events-none hidden opacity-0"
          }`}
        />
      </div>
    </OpenTabsProvider>
  );
}
