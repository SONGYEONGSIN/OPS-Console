"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent } from "react";
import type { WeeklyKpisV2 as WeeklyKpis } from "@/features/ops-weekly/merge";
import { opsWeeklyHref, resolveAppSub } from "../_params";
import { subTabsIdOf } from "./SubTabs";
import { useOpsArea } from "./use-ops-area";
import { useOpsSub } from "./use-ops-sub";
import { useOpsPath } from "./ops-path";

type Target =
  | { tab: "application"; sub: string }
  | { tab: "pims"; sub: null }
  | { tab: "leave"; sub: null };
/** target 이 null 이면 아직 갈 탭이 없는 카드다(성적산출 — 데이터 연결 전). */
type Card = { key: keyof WeeklyKpis; label: string; target: Target | null };

// 카드 8장 — 운영리포트처럼 4장씩 두 줄. 운영 중이 맨 앞, 차주 마감 예정이 맨 뒤(2026-11-25 사용자 지시). 라벨·순서는 여기서만 정한다.
const CARDS: readonly Card[] = [
  {
    key: "running",
    label: "운영 중",
    target: { tab: "application", sub: "running" },
  },
  { key: "dev", label: "개발 중", target: { tab: "application", sub: "dev" } },
  {
    key: "test",
    label: "테스트 중",
    target: { tab: "application", sub: "test" },
  },
  {
    key: "opening",
    label: "차주 오픈 예정",
    target: { tab: "application", sub: "opening" },
  },
  { key: "pims", label: "합격자 발표", target: { tab: "pims", sub: null } },
  { key: "scoreCalc", label: "성적산출", target: null },
  { key: "leave", label: "휴가·외근", target: { tab: "leave", sub: null } },
  {
    key: "closing",
    label: "차주 마감 예정",
    target: { tab: "application", sub: "closing" },
  },
];
const STAGE_KEYS: ReadonlySet<keyof WeeklyKpis> = new Set(["dev", "test"]);

// 운영리포트 KpiCard 와 같은 모양. 카드는 면(面)이라 hover:bg-ink 를 못 쓴다 — 보더만 ink 로 바꾼다.
const CARD_BASE =
  "flex min-w-0 flex-col gap-1 border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const CARD_IDLE = "border-line-soft bg-situation-bg hover:border-ink";
const CARD_ACTIVE = "border-vermilion bg-vermilion/10";

const isPlainLeftClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// 붙은 카드 줄 밑에 하위 탭 줄이 가려져 있으면 보이는 자리까지만 내린다(scroll-margin 이 높이를 알려 준다).
const scrollToSubTabs = (tab: "application" | "pims") =>
  document
    .getElementById(subTabsIdOf(tab))
    ?.scrollIntoView?.({ block: "nearest" });

/**
 * 건수 카드 8장(운영리포트 KPI 카드 모양). 개발/테스트 구분이 수집되지 않았으면(null) 0 이 아니라 `구분 미확인`이다.
 * 일부만 수집됐으면 숫자 옆에 구분이 안 된 건수를 적어 과소집계가 보이게 한다.
 * 카드는 그 영역·하위 탭으로 가는 링크다 — 평범한 왼쪽 클릭은 영역이 같든 다르든 서버 왕복 없이 주소(`tab`·`sub`)만 바꾼다.
 * 내 보고서가 영역을 늘 마운트하기 때문이다.
 */
export function WeeklyKpiRowV2({
  kpis,
  ownerName,
  unknownCount = 0,
  weekStart,
  op,
  appSubState = { showUnknown: false, collected: true },
}: {
  kpis: WeeklyKpis;
  /** 이 숫자가 누구의 보고서 것인지 — 제출 현황·설정 탭에서도 카드가 남아 있어 밝혀야 한다 */
  ownerName: string;
  unknownCount?: number;
  weekStart: string;
  /** 남의 보고서를 보는 중이면 그 이메일 — 링크가 같은 보고서에 머문다 */
  op: string | null;
  /** 원서접수 하위 탭의 보이는 키·기본값을 정하는 사실 — SubTabs 와 같은 해석을 위해 page 가 넘긴다 */
  appSubState?: { showUnknown: boolean; collected: boolean };
}) {
  const { area, setArea } = useOpsArea();
  const { raw } = useOpsSub();
  const appSub = resolveAppSub(raw, appSubState);

  // 다른 영역 카드의 스크롤은 그 영역이 커밋돼 패널이 `hidden` 에서 풀린 뒤에 한다 — Next 는 주소 갱신을
  // transition 안에서 맞추므로 클릭 핸들러(나 rAF 한 번) 안에서는 아직 숨은 줄을 가리켜 아무 일도 안 일어난다.
  const pendingScroll = useRef<"application" | "pims" | null>(null);
  useEffect(() => {
    const tab = pendingScroll.current;
    if (tab === null) return;
    pendingScroll.current = null;
    scrollToSubTabs(tab);
  }, [area]);

  const path = useOpsPath();
  const hrefOf = (t: Target) =>
    opsWeeklyHref(weekStart, t.tab, op, t.sub, path);
  const isActive = (t: Target) => {
    if (t.tab === "application")
      return area === "application" && appSub === t.sub;
    if (t.tab === "pims") return area === "pims";
    return area === "leave";
  };

  function onClick(e: MouseEvent<HTMLAnchorElement>, t: Target) {
    // 수정 키·가운데 클릭은 href 대로(새 탭). 합격자 발표 카드는 href 에 sub 가 없지만(영역 이동은 기본 하위 탭)
    // 클릭하면 금주 발표로 보낸다. 휴가·외근은 하위 탭이 없어 스크롤할 줄도 없다.
    if (!isPlainLeftClick(e)) return;
    e.preventDefault();
    if (t.tab === "leave") {
      setArea("leave", null);
      return;
    }
    setArea(t.tab, t.sub ?? "thisWeek");
    if (t.tab === area) scrollToSubTabs(t.tab);
    else pendingScroll.current = t.tab;
  }

  function body(key: keyof WeeklyKpis, label: string, active: boolean) {
    const value = kpis[key];
    return (
      <>
        <div
          data-testid="weekly-kpi-label"
          className={`text-xs font-medium [overflow-wrap:anywhere] ${active ? "text-vermilion" : "text-muted"}`}
        >
          {label}
        </div>
        {value === null ? (
          <div className="text-sm font-medium text-muted">
            {STAGE_KEYS.has(key) ? "구분 미확인" : "연결 전"}
          </div>
        ) : (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-ink">
              {value.toLocaleString("ko-KR")}
            </span>
            <span className="text-xs text-muted">건</span>
          </div>
        )}
        {value !== null && STAGE_KEYS.has(key) && unknownCount > 0 ? (
          <div className="text-xs text-muted [overflow-wrap:anywhere]">{`구분 미확인 ${unknownCount}건`}</div>
        ) : null}
      </>
    );
  }

  function single({ key, label, target }: Card) {
    // 갈 탭이 없는 카드는 링크가 아니다 — 누를 수 있어 보이면 안 된다.
    if (target === null) {
      return (
        <div key={key} className={`${CARD_BASE} border-line-soft bg-situation-bg`}>
          {body(key, label, false)}
        </div>
      );
    }
    const active = isActive(target);
    return (
      <Link
        key={key}
        href={hrefOf(target)}
        aria-current={active ? "true" : undefined}
        onClick={(e) => {
          onClick(e, target);
        }}
        className={`${CARD_BASE} ${active ? CARD_ACTIVE : CARD_IDLE}`}
      >
        {body(key, label, active)}
      </Link>
    );
  }

  return (
    <>
      <p className="px-5 pt-4 text-xs text-muted lg:px-7">
        {`${ownerName}의 이번 주 · 항목 간 중복 집계될 수 있습니다`}
      </p>
      <div className="grid grid-cols-2 gap-3 px-5 pt-2 md:grid-cols-4 lg:px-7">
        {CARDS.map(single)}
      </div>
    </>
  );
}
