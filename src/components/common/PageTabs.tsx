"use client";

import Link from "next/link";

export type PageTab = { key: string; label: string; href: string };

/**
 * 페이지 내 탭 바 — 모든 도메인 공통 표준 디자인.
 *
 * 디자인: 하단 full-width border-line + 활성 탭 vermilion 굵은 밑줄.
 * (인수인계 탭과 동일 — 기본 디자인 형식. 신규 탭 UI는 이 컴포넌트를 사용한다.)
 *
 * 사용 예:
 *   <PageTabs active={tab} tabs={[
 *     { key: "univ", label: "대학배정", href: "/dashboard/assignments?tab=univ" },
 *     ...
 *   ]} />
 *
 * `size="sm"` — 메인 탭 아래 서브 탭 한 줄. 글자·패딩만 줄이고 밑줄 규칙은 같다.
 * 칩이 아니다(칩은 같은 목록의 필터). 기본 모양은 바뀌지 않는다.
 */
const SIZE_CLASS = {
  md: { bar: "border-line", tab: "px-4 py-2 text-sm" },
  sm: { bar: "border-line-soft", tab: "px-3 py-1.5 text-xs" },
} as const;

export function PageTabs({
  tabs,
  active,
  size = "md",
}: {
  tabs: readonly PageTab[];
  active: string;
  size?: "md" | "sm";
}) {
  const sz = SIZE_CLASS[size];
  return (
    <div className="px-7">
      <div className={`flex gap-1 border-b ${sz.bar}`}>
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px ${sz.tab} ${
                isActive
                  ? "border-b-2 border-vermilion font-semibold text-vermilion"
                  : "border-b-2 border-transparent text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
