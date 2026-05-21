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
 */
export function PageTabs({
  tabs,
  active,
}: {
  tabs: readonly PageTab[];
  active: string;
}) {
  return (
    <div className="px-7">
      <div className="flex gap-1 border-b border-line">
        {tabs.map((t) => {
          const isActive = active === t.key;
          return (
            <Link
              key={t.key}
              href={t.href}
              aria-current={isActive ? "page" : undefined}
              className={`-mb-px px-4 py-2 text-sm ${
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
