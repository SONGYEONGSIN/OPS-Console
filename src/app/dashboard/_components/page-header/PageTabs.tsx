import Link from "next/link";
import { findSidebarSiblings } from "../../_data/sidebar-helpers";

export function PageTabs({ pathname }: { pathname: string }) {
  const siblings = findSidebarSiblings(pathname);
  if (siblings.length <= 1) return null;

  return (
    <nav role="tablist" aria-label="형제 메뉴" className="flex items-center gap-1">
      {siblings.map((item) => {
        const active = item.href === pathname;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={`relative px-3 py-1.5 text-sm transition-colors ${
              active ? "font-bold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {item.label}
            {active && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
              />
            )}
          </Link>
        );
      })}
    </nav>
  );
}
