"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { OperatingGuideTab } from "../_data/tabs";

type Props = {
  tabs: OperatingGuideTab[];
};

/**
 * 운영 가이드 좌측 nav.
 * /dashboard/settings 의 SettingsClient nav 톤(◉ · / border-vermilion / bg-vermilion/10) 차용.
 * URL ?tab= 으로 선택 상태 관리. 미지정 시 첫 탭(바이브코딩).
 */
export function OpsGuideNav({ tabs }: Props) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") ?? tabs[0]?.value;

  function hrefFor(value: string): string {
    const params = new URLSearchParams();
    params.set("tab", value);
    return `${pathname}?${params.toString()}`;
  }

  return (
    <nav
      aria-label="운영 가이드 탭"
      className="flex flex-col gap-1 border-r border-line pr-4 max-md:flex-row max-md:overflow-x-auto max-md:border-r-0 max-md:border-b max-md:pb-3 max-md:pr-0"
    >
      {tabs.map((tab) => {
        const active = tab.value === currentTab;
        return (
          <Link
            key={tab.value}
            href={hrefFor(tab.value)}
            aria-current={active ? "page" : undefined}
            className={`flex items-start gap-2 border-l-2 px-3 py-2 text-left text-sm transition-colors max-md:border-l-0 max-md:border-b-2 max-md:px-4 ${
              active
                ? "border-vermilion bg-vermilion/10 font-medium text-vermilion"
                : "border-transparent text-ink hover:bg-line-soft"
            }`}
          >
            <span className="mt-0.5 text-xs">{active ? "◉" : "·"}</span>
            <span className="flex-1">
              <span className="block">{tab.label}</span>
              <span className="block text-xs text-muted">{tab.desc}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
