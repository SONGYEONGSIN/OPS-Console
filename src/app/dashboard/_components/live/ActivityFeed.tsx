type Item = {
  id: string;
  ts: string;
  who: string;
  what: string;
};

export function ActivityFeed({ items }: { items: Item[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-muted">활동 없음 — 정상</p>;
  }
  return (
    <ul className="divide-y divide-line-soft">
      {items.map((it) => (
        <li
          key={it.id}
          className="grid grid-cols-[64px_96px_1fr] items-baseline gap-3 py-2.5 text-sm"
        >
          <span className="font-mono text-xs text-muted">{it.ts}</span>
          <span className="truncate text-ink">{it.who}</span>
          <span className="truncate text-ink">{it.what}</span>
        </li>
      ))}
    </ul>
  );
}
