"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export type CategoryItem = {
  /** URL ?category= 값. 폴더 그룹은 "_folder", 기타는 "_etc" */
  value: string;
  /** 표시 라벨 (A / B / 폴더 / 기타) */
  label: string;
  /** 한국어 설명 (A → 원서접수). 없으면 null */
  desc: string | null;
  /** 정렬 순서 — 폴더 0 / A~I 1~9 / 기타 99 */
  sortOrder: number;
  count: number;
};

type Props = {
  totalCount: number;
  categories: CategoryItem[];
};

/**
 * 매뉴얼 좌측 카테고리 트리.
 * - "전체" + 폴더 그룹 + A~I 카테고리 + 기타
 * - URL ?category= 로 선택 상태 관리. 미지정 시 "전체"
 * - 현재 선택 row는 좌측 vermilion border + bg-washi-raised
 */
export function ManualSidebar({ totalCount, categories }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentCategory = searchParams.get("category") ?? "all";

  function hrefFor(value: string): string {
    if (value === "all") return pathname;
    const params = new URLSearchParams();
    params.set("category", value);
    return `${pathname}?${params.toString()}`;
  }

  const sorted = [...categories].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <nav
      aria-label="매뉴얼 카테고리"
      className="flex w-[220px] shrink-0 flex-col gap-1 border-r border-line-soft bg-washi p-3 text-sm"
    >
      <CategoryRow
        href={hrefFor("all")}
        active={currentCategory === "all"}
        label="전체"
        desc={null}
        count={totalCount}
      />
      <div className="my-2 h-px bg-line-soft" />
      {sorted.map((c) => (
        <CategoryRow
          key={c.value}
          href={hrefFor(c.value)}
          active={currentCategory === c.value}
          label={c.label}
          desc={c.desc}
          count={c.count}
        />
      ))}
    </nav>
  );
}

function CategoryRow({
  href,
  active,
  label,
  desc,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  desc: string | null;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center justify-between rounded-sm px-2 py-1.5 transition-colors ${
        active
          ? "border-l-2 border-vermilion bg-washi-raised font-semibold text-ink"
          : "border-l-2 border-transparent text-ink-soft hover:bg-washi-raised hover:text-ink"
      }`}
    >
      <span className="truncate">
        <span className="font-medium">{label}</span>
        {desc ? <span className="ml-1 text-xs text-muted">{desc}</span> : null}
      </span>
      <span className="ml-2 shrink-0 text-xs text-muted">{count}</span>
    </Link>
  );
}
