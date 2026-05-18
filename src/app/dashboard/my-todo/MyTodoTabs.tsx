"use client";

import Link from "next/link";

type Tab = "weekly" | "project";

type Props = {
  activeTab: Tab;
  weeklyContent: React.ReactNode;
  projectContent: React.ReactNode;
};

const TABS: { key: Tab; label: string }[] = [
  { key: "weekly", label: "원서접수" },
  { key: "project", label: "프로젝트" },
];

export function MyTodoTabs({ activeTab, weeklyContent, projectContent }: Props) {
  return (
    <>
      <div className="px-7">
        <div className="flex gap-1 border-b border-line">
          {TABS.map((t) => {
            const isActive = activeTab === t.key;
            const href =
              t.key === "weekly"
                ? "/dashboard/my-todo"
                : `/dashboard/my-todo?tab=${t.key}`;
            return (
              <Link
                key={t.key}
                href={href}
                aria-current={isActive ? "page" : undefined}
                role="tab"
                aria-selected={isActive}
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
      <div>{activeTab === "weekly" ? weeklyContent : projectContent}</div>
    </>
  );
}
