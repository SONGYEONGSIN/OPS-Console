"use client";

import Link from "next/link";
import { useEffect, useRef, type MouseEvent } from "react";
import type { WeeklyKpis } from "@/features/ops-weekly/merge";
import { opsWeeklyHref, resolveAppSub } from "../_params";
import { subTabsIdOf } from "./SubTabs";
import { useOpsArea } from "./use-ops-area";
import { useOpsSub } from "./use-ops-sub";

type Target = { tab: "application" | "pims"; sub: string | null };
type Card = { key: keyof WeeklyKpis; label: string; target: Target };

// 라벨·순서는 여기서만 정한다. 합격자 발표는 맨 끝(원서접수 카드들과 갈라 읽힌다).
const STAGE_CARDS: readonly Card[] = [
  { key: "dev", label: "개발 중", target: { tab: "application", sub: "dev" } },
  {
    key: "test",
    label: "테스트 중",
    target: { tab: "application", sub: "test" },
  },
  {
    key: "running",
    label: "운영 중",
    target: { tab: "application", sub: "running" },
  },
];
const PIMS_CARD: Card = {
  key: "pims",
  label: "합격자 발표",
  target: { tab: "pims", sub: null },
};
// 한 장에 두 칸으로 묶는다 — 운영리포트 '계약 체결'(ContractSheetCard)과 같은 모양.
// 합계는 내지 않는다: 접수 중이면서 차주 마감인 건이 둘 다 들 수 있어 합이 뜻을 잃는다.
const PAIR_LABEL = "차주 오픈 / 마감";
const PAIR: readonly Card[] = [
  {
    key: "opening",
    label: "차주 오픈 예정",
    target: { tab: "application", sub: "opening" },
  },
  {
    key: "closing",
    label: "차주 마감 예정",
    target: { tab: "application", sub: "closing" },
  },
];
const STAGE_KEYS: ReadonlySet<keyof WeeklyKpis> = new Set(["dev", "test"]);

// 카드는 면(面)이라 hover:bg-ink 를 못 쓴다 — 보더만 ink 로 바꾼다.
const CARD_BASE =
  "flex min-w-0 flex-col gap-1 border p-3 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:p-4";
const CARD_IDLE = "border-line-soft bg-situation-bg hover:border-ink";
const CARD_ACTIVE = "border-vermilion bg-vermilion/10";
const SEG_BASE =
  "-m-1 flex min-w-0 flex-1 flex-col gap-0.5 border p-1 transition-colors focus-visible:outline-2 focus-visible:outline-ink";
const SEG_IDLE = "border-transparent hover:border-ink";

const isPlainLeftClick = (e: MouseEvent) =>
  e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;

// 붙은 카드 줄 밑에 하위 탭 줄이 가려져 있으면 보이는 자리까지만 내린다(scroll-margin 이 높이를 알려 준다).
const scrollToSubTabs = (tab: Target["tab"]) =>
  document
    .getElementById(subTabsIdOf(tab))
    ?.scrollIntoView?.({ block: "nearest" });

/**
 * 건수 카드 5장(한 장은 두 칸 — 차주 오픈·마감). 개발/테스트 구분이 수집되지 않았으면(null) 0 이 아니라 `구분 미확인`이다.
 * 일부만 수집됐으면 숫자 옆에 구분이 안 된 건수를 적어 과소집계가 보이게 한다.
 * 카드는 그 영역·하위 탭으로 가는 링크다 — 평범한 왼쪽 클릭은 영역이 같든 다르든 서버 왕복 없이 주소(`tab`·`sub`)만 바꾼다.
 * 내 보고서가 영역 셋을 늘 마운트하기 때문이다.
 */
export function WeeklyKpiRow({
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
  const pendingScroll = useRef<Target["tab"] | null>(null);
  useEffect(() => {
    const tab = pendingScroll.current;
    if (tab === null) return;
    pendingScroll.current = null;
    scrollToSubTabs(tab);
  }, [area]);

  const hrefOf = (t: Target) => opsWeeklyHref(weekStart, t.tab, op, t.sub);
  const isActive = (t: Target) =>
    t.tab === "pims"
      ? area === "pims"
      : area === "application" && appSub === t.sub;

  function onClick(e: MouseEvent<HTMLAnchorElement>, t: Target) {
    // 수정 키·가운데 클릭은 href 대로(새 탭). 합격자 발표 카드는 href 에 sub 가 없지만(영역 이동은 기본 하위 탭)
    // 클릭하면 금주 발표로 보낸다.
    if (!isPlainLeftClick(e)) return;
    e.preventDefault();
    setArea(t.tab, t.sub ?? "thisWeek");
    if (t.tab === area) scrollToSubTabs(t.tab);
    else pendingScroll.current = t.tab;
  }

  function single({ key, label, target }: Card) {
    const value = kpis[key];
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
        <div
          data-testid="weekly-kpi-label"
          className={`text-xs font-medium [overflow-wrap:anywhere] ${active ? "text-vermilion" : "text-muted"}`}
        >
          {label}
        </div>
        {value === null ? (
          <div className="text-sm font-medium text-muted">구분 미확인</div>
        ) : (
          <div className="text-xl font-bold tabular-nums text-ink md:text-2xl">
            {value.toLocaleString("ko-KR")}
            <span className="ml-0.5 text-sm font-medium text-muted">건</span>
          </div>
        )}
        {value !== null && STAGE_KEYS.has(key) && unknownCount > 0 ? (
          <div className="text-xs text-muted [overflow-wrap:anywhere]">{`구분 미확인 ${unknownCount}건`}</div>
        ) : null}
      </Link>
    );
  }

  return (
    <>
      <p className="px-5 pt-4 text-xs text-muted lg:px-7">
        {`${ownerName}의 이번 주 · 항목 간 중복 집계될 수 있습니다`}
      </p>
      <div className="grid grid-cols-3 gap-2 px-5 pt-2 md:gap-3 lg:grid-cols-6 lg:px-7">
        {STAGE_CARDS.map(single)}
        <div
          role="group"
          aria-label={PAIR_LABEL}
          className="col-span-2 flex min-w-0 flex-col gap-1 border border-line-soft bg-situation-bg p-3 md:p-4"
        >
          <div className="text-xs font-medium text-muted">{PAIR_LABEL}</div>
          <div className="flex gap-3">
            {PAIR.map(({ key, label, target }, i) => {
              const active = isActive(target);
              return (
                <div key={key} className="flex min-w-0 flex-1 gap-3">
                  {i > 0 ? (
                    <div className="w-px shrink-0 self-stretch bg-line-soft" />
                  ) : null}
                  <Link
                    href={hrefOf(target)}
                    data-segment={key}
                    aria-current={active ? "true" : undefined}
                    onClick={(e) => {
                      onClick(e, target);
                    }}
                    className={`${SEG_BASE} ${active ? CARD_ACTIVE : SEG_IDLE}`}
                  >
                    <div
                      data-testid="weekly-kpi-label"
                      className={`text-2xs [overflow-wrap:anywhere] ${active ? "text-vermilion" : "text-muted"}`}
                    >
                      {label}
                    </div>
                    <div className="text-xl font-bold tabular-nums text-ink md:text-2xl">
                      {(kpis[key] ?? 0).toLocaleString("ko-KR")}
                      <span className="ml-0.5 text-sm font-medium text-muted">
                        건
                      </span>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
        {single(PIMS_CARD)}
      </div>
    </>
  );
}
