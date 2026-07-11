"use client";

import Link from "next/link";
import { useOpenTabs } from "./open-tabs-context";
import { useAutoAddTab } from "./use-auto-add-tab";

export function PageTabs({ pathname }: { pathname: string }) {
  useAutoAddTab();
  const { tabs, close, isGroupChild } = useOpenTabs();

  if (!isGroupChild(pathname)) return null;
  if (tabs.length === 0) return null;

  return (
    <nav
      role="tablist"
      aria-label="열린 메뉴"
      className="flex items-end self-end"
    >
      {tabs.map((tab) => {
        const active = tab.href === pathname;
        return (
          <div
            key={tab.slug}
            className={`relative flex items-center gap-2 px-5 py-2 text-sm transition-colors ${
              active
                ? "-mb-px border border-t-2 border-x-line-soft border-b-paper border-t-vermilion bg-paper font-bold text-ink"
                : "border-t-2 border-transparent text-muted hover:text-ink"
            }`}
          >
            <Link
              href={tab.href}
              role="tab"
              aria-selected={active}
              className="block"
            >
              {tab.label}
            </Link>
            <button
              type="button"
              aria-label={`${tab.label} 닫기`}
              onClick={(e) => {
                e.preventDefault();
                close(tab.slug);
              }}
              className="cursor-pointer border-none bg-transparent text-xs text-faint hover:text-vermilion"
            >
              ×
            </button>
          </div>
        );
      })}
    </nav>
  );
}
