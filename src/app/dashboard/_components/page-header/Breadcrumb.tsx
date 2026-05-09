import { findSidebarBreadcrumb } from "../../_data/sidebar-helpers";

export function Breadcrumb({ pathname }: { pathname: string }) {
  const crumbs = findSidebarBreadcrumb(pathname);
  if (crumbs.length === 0) return null;

  return (
    <nav aria-label="경로" className="flex items-center gap-1.5 text-xs text-muted">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <span className={i === crumbs.length - 1 ? "font-medium text-ink" : ""}>
            {crumb.label}
          </span>
          {i < crumbs.length - 1 && (
            <span aria-hidden className="text-line-soft">/</span>
          )}
        </span>
      ))}
    </nav>
  );
}
