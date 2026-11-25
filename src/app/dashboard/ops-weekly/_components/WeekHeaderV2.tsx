"use client";

import Link from "next/link";
import type { WeekRef } from "@/features/ops-weekly/week";
import { useOpsArea } from "./use-ops-area";

type Props = {
  weekRef: WeekRef;
  /** 내 보고서 화면이면 주 버튼이 지금 영역(URL)을 따라간다 — replaceState 뒤 서버 값은 낡았다. */
  showReportState: boolean;
  thisWeekHref: string;
  nextWeekHref: string;
  /** 지금 보는 주가 달력의 이번 주·다음 주 중 어느 것인지 — 다른 주면 null(둘 다 꺼짐). */
  current: "this" | "next" | null;
};

// 운영리포트 기간 버튼(PeriodSelector)과 같은 모양. 꺼진 칸 호버는 버튼 표준(검정).
const WEEK_BTN = "border px-3 py-1.5 text-xs";
const WEEK_ON = "border-vermilion bg-vermilion text-cream";
const WEEK_OFF =
  "border-line bg-transparent text-ink hover:border-ink hover:bg-ink hover:text-cream";

function withTab(href: string, tab: string): string {
  const [path, query = ""] = href.split("?");
  const params = new URLSearchParams(query);
  params.set("tab", tab);
  return `${path}?${params.toString()}`;
}

/**
 * 새 화면 메뉴의 머리 — 운영리포트 머리와 같은 짜임(왼쪽 제목·일정, 오른쪽 주 버튼)이고 그것뿐이다.
 * 내/전체 보고서 토글·상태·제출·당번·안내 줄은 뺐다(2026-11-25 사용자 지시 — 기존 메뉴에는 그대로 있다).
 */
export function WeekHeaderV2(props: Props) {
  const { area } = useOpsArea();
  const { weekRef } = props;
  const follow = (href: string) =>
    props.showReportState ? withTab(href, area) : href;
  const weekButtons = [
    {
      key: "this" as const,
      label: "이번 주",
      href: follow(props.thisWeekHref),
    },
    {
      key: "next" as const,
      label: "다음 주",
      href: follow(props.nextWeekHref),
    },
  ];
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-5 pt-4 text-sm text-ink lg:px-7">
      <div>
        <h2 className="text-xl font-bold text-ink">주간업무보고</h2>
        <p className="mt-1 text-xs text-muted tabular-nums">{`${weekRef.label} · ${weekRef.rangeLabel}`}</p>
      </div>
      <div
        className="flex flex-wrap items-center gap-1"
        role="group"
        aria-label="주 선택"
      >
        {weekButtons.map((b) => {
          const on = props.current === b.key;
          return (
            <Link
              key={b.key}
              href={b.href}
              aria-current={on ? "page" : undefined}
              className={`${WEEK_BTN} ${on ? WEEK_ON : WEEK_OFF}`}
            >
              {b.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
