"use client";

import type { KeyboardEvent, ReactNode } from "react";
import { ListPagination } from "@/components/common/ListPagination";
import { ScopeChips } from "@/components/common/ScopeChips";
import {
  LIST_PAGE_SIZE,
  schoolDetail,
  type DetailSource,
} from "@/features/sms-sender/filters";
import { SchoolInspector } from "./SchoolInspector";
import { SourceBar, type SourceInfo } from "./SourceBar";
import { useSelectedSchool } from "./use-selected-school";

/** 세 화면이 같이 받는 것 — 현황 파일 정보와 인스펙터가 찾아볼 전체 자료. */
export type ListContext = { source: SourceInfo; lookup: DetailSource };

type Selection = {
  selectedNo: number | null;
  select: (no: number) => void;
};

type Props = {
  ctx: ListContext;
  /** 검색줄 위(학교 탭의 구분 카드). */
  top?: ReactNode;
  /** 검색줄 — ListSearch(flex-1) + ListSelect 들. */
  controls: ReactNode;
  title: string;
  /** 지금 조건(범위 포함)에 맞는 건수 = 쪽 넘기기 total. */
  count: number;
  unit: "곳" | "건";
  /** '전체 (N)' 칩 옆 숫자 — 범위(내 대학)만 뺀 건수. */
  scopeTotal: number;
  emptyText: string;
  children: (sel: Selection) => ReactNode;
};

/**
 * 학교·발신번호·확인 필요 세 화면의 목록 골격 — `ListPattern` 실물을 그대로 옮겼다.
 *
 * 검색줄(`px-7 pt-3`) → `section p-7` > `header mb-4`(왼쪽 제목 · 건수 + 전체/내 대학,
 * 오른쪽 현황 파일·새로고침·서류 기준) → 표 → 쪽 넘기기. 인스펙터가 열리면
 * 본문이 `md:pr-[340px]` 로 비켜난다(ListPattern·전도금과 같은 값·같은 전환).
 *
 * `ListPattern` 을 쓰지 않는 이유: 그쪽은 `ListRow` 와 variant 레지스트리에 묶여
 * 있고 행 선택이 자기 상태다. 여기는 행이 학교·번호·확인 셋이고, 셋 다 '그 학교'
 * 인스펙터를 연다.
 */
export function SmsListShell({
  ctx,
  top,
  controls,
  title,
  count,
  unit,
  scopeTotal,
  emptyText,
  children,
}: Props) {
  const [selectedNo, select] = useSelectedSchool();
  const detail = schoolDetail(ctx.lookup, selectedNo);
  const drawerPadding = detail ? "md:pr-[340px]" : "";

  return (
    <>
      <div
        className={`flex flex-col transition-[padding] duration-[var(--drawer-ms)] ease-[var(--drawer-ease)] ${drawerPadding}`}
      >
        {top}
        <div className="flex flex-wrap items-center gap-2 px-7 pt-3">
          {controls}
        </div>
        <section className="p-7">
          <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <div className="flex items-baseline gap-2">
                <h2 className="text-xl font-bold text-ink">{title}</h2>
                <span className="text-muted" aria-hidden>
                  ·
                </span>
                <span className="text-sm tabular-nums text-vermilion">
                  {`${count}${unit}`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                <ScopeChips total={scopeTotal} mineLabel="내 대학" />
              </div>
            </div>
            <SourceBar {...ctx.source} />
          </header>

          {count === 0 ? (
            <p className="bg-situation-bg px-3 py-8 text-center text-sm text-muted">
              {emptyText}
            </p>
          ) : (
            <div className="overflow-x-auto">
              {children({ selectedNo: detail ? selectedNo : null, select })}
            </div>
          )}

          <ListPagination total={count} pageSize={LIST_PAGE_SIZE} />
        </section>
      </div>
      <SchoolInspector detail={detail} onClose={() => select(null)} />
    </>
  );
}

/**
 * 목록 행 — 호버 `hover:bg-line-soft`, 선택 `border-vermilion bg-vermilion/10
 * text-vermilion`(CLAUDE.md 인터랙션 표준). 학교가 없는 행(`onSelect` null)은
 * 누를 곳이 아니라 커서·키보드 초점을 주지 않는다.
 */
export function rowProps({
  selected,
  onSelect,
  extra = "",
}: {
  selected: boolean;
  onSelect: (() => void) | null;
  extra?: string;
}) {
  const tone = selected
    ? "border-vermilion bg-vermilion/10 text-vermilion"
    : "border-line-soft";
  const base = `border-b hover:bg-line-soft ${tone} ${extra}`.trim();
  if (!onSelect) return { className: base };
  return {
    className: `cursor-pointer ${base}`,
    "aria-selected": selected,
    tabIndex: 0,
    onClick: onSelect,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === "Enter") onSelect();
    },
  };
}
