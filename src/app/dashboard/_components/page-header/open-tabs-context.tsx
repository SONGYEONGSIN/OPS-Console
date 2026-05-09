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
      if (prev.some((t) => t.slug === tab.slug)) return prev;
      return [...prev, tab];
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
