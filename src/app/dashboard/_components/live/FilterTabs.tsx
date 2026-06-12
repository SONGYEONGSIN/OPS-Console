"use client";

export type LiveFilter =
  | "all"
  | "incidents"
  | "todos"
  | "services"
  | "backup"
  | "handover"
  | "schedule"
  | "contracts"
  | "notice"
  | "receivables";
type Counts = Record<LiveFilter, number>;

const ORDER: { key: LiveFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "services", label: "서비스" },
  { key: "todos", label: "내 할 일" },
  { key: "incidents", label: "사고" },
  { key: "backup", label: "백업" },
  { key: "handover", label: "인수인계" },
  { key: "schedule", label: "일정" },
  { key: "contracts", label: "계약" },
  { key: "notice", label: "공지" },
  { key: "receivables", label: "미수채권" },
];

type Props = { active: LiveFilter; counts: Counts; onChange: (next: LiveFilter) => void };

/** 실시간 테이블 필터 칩 — 전체 + 9개 도메인. 일반 메뉴(ListPattern)와 동일한
    밑줄형 탭 스타일: active = 굵게 + vermilion 밑줄, inactive = muted. `라벨 (건수)`. */
export function FilterTabs({ active, counts, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {ORDER.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(t.key)}
            className={`relative cursor-pointer border-none bg-transparent px-3 py-1 text-sm transition-colors ${
              isActive ? "font-bold text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label} (<span className="tabular-nums">{counts[t.key]}</span>)
            {isActive && (
              <span
                aria-hidden
                className="absolute bottom-[-1px] left-0 right-0 h-0.5 bg-vermilion"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
