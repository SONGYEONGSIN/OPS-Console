import Link from "next/link";

export type ProjectEntryItem = {
  slug: string;
  label: string;
  manager: string;
  quarter: string;
  count: string;
  suspended?: boolean;
};

/**
 * ProjectEntry — 1면 "도메인 12종"의 한 줄 진입점.
 * 카드가 아니라 신문 기사 헤드 묶음처럼 라벨 → 메타 → 날인을 한 줄로 압축.
 */
function ProjectEntry({ item }: { item: ProjectEntryItem }) {
  return (
    <Link
      href={`/dashboard/${item.slug}`}
      className="group flex items-baseline justify-between gap-4 border-b border-line-soft py-3 transition-colors hover:bg-washi-raised"
    >
      <div className="flex min-w-0 items-baseline gap-3">
        <span className="font-mono text-2xs uppercase tracking-[0.18em] text-faint group-hover:text-vermilion">
          {item.slug.slice(0, 4)}
        </span>
        <span className="truncate text-sm font-semibold text-ink">
          {item.label}
        </span>
        {item.suspended ? (
          <span className="border border-line px-1.5 text-2xs uppercase tracking-[0.12em] text-muted">
            보류
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-baseline gap-3 font-mono text-2xs tracking-[0.06em] text-ink-soft">
        <span>{item.manager}</span>
        <span aria-hidden className="h-2 w-px bg-line-soft" />
        <span className="text-ink">{item.quarter}</span>
        <span aria-hidden className="h-2 w-px bg-line-soft" />
        <span className="text-muted">{item.count}</span>
      </div>
    </Link>
  );
}

/**
 * ProjectGrid — 12 도메인을 두 열로 묶은 칼럼 리스트.
 * 입실자가 "오늘 어디로 들어갈지" 정하는 진입점이며,
 * 7개씩 두 칼럼이 아니라 6+6 균형으로 좌우 페어링한다.
 */
export function ProjectGrid({ items }: { items: ProjectEntryItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 md:grid-cols-2">
      {items.map((p) => (
        <ProjectEntry key={p.slug} item={p} />
      ))}
    </div>
  );
}
