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
  dense = false,
}: {
  items: { term: string; desc: ReactNode }[];
  dense?: boolean;
}) {
  return (
    <dl
      className={`grid grid-cols-[88px_1fr] gap-x-3 text-sm ${dense ? "gap-y-1" : "gap-y-2"}`}
    >
      {/* dense=true: 행 간격 축소(gap-y-1) — 메일함 등 조밀 표시용 */}
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

/**
 * 처리(시간/내용) 행 본문 — 음영 박스 안에 일시 + 내용 2열.
 * 행이 없으면 fallback(레거시 text)을 같은 음영 박스로, 그마저 없으면 "—".
 * 사고정보·경위서 인스펙터 양쪽 공용.
 */
export function HandlingRowsBody({
  rows,
  fallback,
}: {
  rows?: { time: string; content: string }[] | null;
  fallback?: string | null;
}) {
  const filled = (rows ?? []).filter((r) => r.time.trim() || r.content.trim());
  if (filled.length === 0) {
    if (!fallback) return <span className="text-xs text-muted">—</span>;
    return (
      <p className="whitespace-pre-wrap rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
        {fallback}
      </p>
    );
  }
  return (
    <div className="space-y-1.5 rounded bg-washi-raised p-2.5 text-sm leading-relaxed text-ink">
      {filled.map((r, i) => (
        <div key={i} className="flex gap-2">
          <span className="w-28 flex-none text-muted">{r.time || "—"}</span>
          <span className="min-w-0 flex-1 whitespace-pre-wrap">{r.content}</span>
        </div>
      ))}
    </div>
  );
}
