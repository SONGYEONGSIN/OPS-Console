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
 * 매뉴얼 좌측 카테고리 nav.
 * 디자인은 /dashboard/settings 의 SettingsClient nav와 동일 톤 — vermilion 강조.
 * URL ?category= 로 선택 상태 관리. 미지정 시 "전체".
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
      className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pb-3 max-md:pr-0"
    >
      <CategoryButton
        href={hrefFor("all")}
        active={currentCategory === "all"}
        label="전체"
        desc={null}
        count={totalCount}
      />
      {sorted.map((c) => (
        <CategoryButton
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

function CategoryButton({
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
      aria-current={active ? "page" : undefined}
      className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
        active
          ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
          : "border-transparent text-ink hover:bg-line-soft"
      }`}
    >
      <span className="text-xs">{active ? "◉" : "·"}</span>
      <span className="flex-1 truncate">
        <span>{label}</span>
        {desc ? <span className="ml-1 text-xs text-muted">{desc}</span> : null}
      </span>
      <span className="shrink-0 text-xs text-muted">{count}</span>
    </Link>
  );
}
