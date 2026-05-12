import { AutoRefreshCountdown } from "./AutoRefreshCountdown";

export type MetaItem = {
  label: string;
  value?: string;
  tone?: "default" | "accent";
};

export function PageMeta({
  items,
  autoRefresh = false,
}: {
  items: MetaItem[];
  autoRefresh?: boolean;
}) {
  if (items.length === 0 && !autoRefresh) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.tone === "accent" ? (
            <strong className="text-vermilion">{item.label}</strong>
          ) : item.value !== undefined ? (
            <span>
              <strong className="text-ink">{item.label}</strong> {item.value}
            </span>
          ) : (
            <span>{item.label}</span>
          )}
          {(i < items.length - 1 || autoRefresh) && (
            <span aria-hidden className="text-line-soft">
              ·
            </span>
          )}
        </span>
      ))}
      {autoRefresh && (
        <span className="flex items-center">
          <AutoRefreshCountdown />
        </span>
      )}
    </div>
  );
}
