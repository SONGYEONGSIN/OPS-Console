"use client";

export type LiveFilter = "all" | "incidents" | "todos" | "services" | "backup";
type Counts = Record<LiveFilter, number>;

const ORDER: { key: LiveFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "incidents", label: "사고" },
  { key: "todos", label: "내 할 일" },
  { key: "services", label: "서비스" },
  { key: "backup", label: "백업 · 일정" },
];

type Props = { active: LiveFilter; counts: Counts; onChange: (next: LiveFilter) => void };

/** 실시간 테이블 필터 칩 — 5탭 + pill 건수. active=vermilion. */
export function FilterTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ORDER.map((t) => {
        const isActive = active === t.key;
        const cls = isActive
          ? "border border-vermilion bg-vermilion px-3 py-1 text-xs font-semibold text-cream cursor-pointer"
          : "border border-line-soft bg-transparent px-3 py-1 text-xs font-semibold text-ink-soft hover:border-ink hover:bg-washi-raised cursor-pointer";
        return (
          <button key={t.key} type="button" onClick={() => onChange(t.key)} className={cls}>
            {t.label} <span className="ml-1 tabular-nums">{counts[t.key]}</span>
          </button>
        );
      })}
    </div>
  );
}
