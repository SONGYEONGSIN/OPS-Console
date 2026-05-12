import type { ReactNode } from "react";

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h4 className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
        {title}
      </h4>
      {children}
    </section>
  );
}

export function DefList({
  items,
}: {
  items: { term: string; desc: ReactNode }[];
}) {
  return (
    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-2 text-sm">
      {items.map((item, i) => (
        <div key={i} className="contents">
          <dt className="text-xs text-muted">{item.term}</dt>
          <dd className="text-ink">{item.desc}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Divider() {
  return <div className="border-t border-line" />;
}
