"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { findSidebarParentGroup } from "../../_data/sidebar-helpers";

const STORAGE_KEY = "folio.openTabs";

export type OpenTab = {
  slug: string;
  href: string;
  label: string;
  /** 소속 사이드바 그룹 label. 그룹이 바뀌면 탭 strip을 초기화하는 기준. */
  group?: string | null;
};

export type OpenTabsState = {
  tabs: OpenTab[];
  add: (tab: OpenTab) => void;
  close: (slug: string) => void;
  isGroupChild: (pathname: string) => boolean;
};

const Ctx = createContext<OpenTabsState | null>(null);

function loadInitial(): OpenTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as OpenTab[]) : [];
  } catch {
    return [];
  }
}

export function OpenTabsProvider({ children }: { children: React.ReactNode }) {
  const [tabs, setTabs] = useState<OpenTab[]>(loadInitial);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
  }, [tabs]);

  const add = useCallback((tab: OpenTab) => {
    setTabs((prev) => {
      // 현재 탭이 속한 사이드바 그룹. 이전 탭들과 그룹이 다르면 초기화한다
      // (다른 메뉴 그룹으로 이동 시 이전 그룹 탭이 남지 않도록).
      const group = findSidebarParentGroup(tab.href);
      const withGroup: OpenTab = { ...tab, group };
      const prevGroup = prev.length > 0 ? (prev[0].group ?? null) : null;
      if (prev.length > 0 && prevGroup !== group) {
        return [withGroup];
      }
      if (prev.some((t) => t.slug === tab.slug)) return prev;
      return [...prev, withGroup];
    });
  }, []);

  const close = useCallback(
    (slug: string) => {
      setTabs((prev) => {
        const idx = prev.findIndex((t) => t.slug === slug);
        if (idx < 0) return prev;
        const next = [...prev.slice(0, idx), ...prev.slice(idx + 1)];

        const closingActive = `/dashboard/${slug}` === pathname;
        if (closingActive) {
          const target = next[idx - 1] ?? next[idx] ?? null;
          router.push(target?.href ?? "/dashboard");
        }
        return next;
      });
    },
    [pathname, router],
  );

  const isGroupChild = useCallback(
    (path: string): boolean => findSidebarParentGroup(path) !== null,
    [],
  );

  return (
    <Ctx.Provider value={{ tabs, add, close, isGroupChild }}>
      {children}
    </Ctx.Provider>
  );
}

export function useOpenTabs(): OpenTabsState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useOpenTabs must be inside OpenTabsProvider");
  return v;
}
