import Link from "next/link";
import { findSidebarSiblings } from "../../_data/sidebar-helpers";

export function PageTabs({ pathname }: { pathname: string }) {
  const siblings = findSidebarSiblings(pathname);
  if (siblings.length <= 1) return null;

  return (
    <nav
      role="tablist"
      aria-label="형제 메뉴"
      className="flex items-center"
    >
      {siblings.map((item) => {
        const active = item.href === pathname;
        return (
          <Link
            key={item.href}
            href={item.href}
            role="tab"
            aria-selected={active}
            className={`relative px-5 py-2 text-sm transition-colors ${
              active
                ? "border-t-2 border-vermilion bg-cream font-bold text-ink"
                : "border-t-2 border-transparent text-muted hover:text-ink"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
