"use client";

import type { ReactNode } from "react";

export type SectionMenuItem<K extends string> = {
  key: K;
  label: string;
  /** undefined = 배지 없음(못 읽음 포함), 0 = 0건으로 그린다 */
  badge?: number;
};

type Props<K extends string> = {
  ariaLabel: string;
  items: readonly SectionMenuItem<K>[];
  active: K;
  onSelect: (key: K) => void;
  children: ReactNode;
};

/** 왼쪽 메뉴 + 오른쪽 내용. md 이상은 메뉴가 붙어 있고(sticky) 내용만 스크롤된다. md 미만은 메뉴가 위로 쌓인 가로 줄이 된다. */
export function SectionMenuLayout<K extends string>({
  ariaLabel,
  items,
  active,
  onSelect,
  children,
}: Props<K>) {
  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      {/* 세로선은 늘어나는 바깥 칸이 긋고, 메뉴는 그 안에서 붙어 있다 — 오른쪽 내용만 스크롤된다. */}
      <div className="border-line md:border-r md:pr-4">
        <nav
          aria-label={ariaLabel}
          className="flex flex-col gap-1 md:sticky md:top-4 max-md:flex-row max-md:overflow-x-auto max-md:border-b max-md:border-line max-md:pb-3"
        >
          {items.map((item) => {
            const selected = item.key === active;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelect(item.key)}
                aria-pressed={selected}
                className={`flex items-center gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:shrink-0 max-md:whitespace-nowrap max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
                  selected
                    ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                    : "border-transparent text-ink hover:bg-line-soft"
                }`}
              >
                <span aria-hidden="true" className="text-xs">
                  {selected ? "◉" : "·"}
                </span>
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ml-auto text-xs tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
      <div className="flex min-w-0 flex-col gap-4">{children}</div>
    </div>
  );
}
