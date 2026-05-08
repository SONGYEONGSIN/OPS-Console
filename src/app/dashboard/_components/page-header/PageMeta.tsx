export type MetaItem = {
  label: string;
  value?: string;
  tone?: "default" | "accent";
};

export function PageMeta({ items }: { items: MetaItem[] }) {
  if (items.length === 0) return null;
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
          {i < items.length - 1 && (
            <span aria-hidden className="text-line-soft">
              ·
            </span>
          )}
        </span>
      ))}
    </div>
  );
}
