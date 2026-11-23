"use client";

import { useRef, type KeyboardEvent } from "react";
import {
  AREA_TABS,
  AREA_TAB_TITLE,
  REPORT_TABS,
  SUBMIT_TAB_TITLE,
  visibleArea,
  type ReportTab,
} from "../_params";
import { neighbour } from "./SubTabs";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 맨 끝 `제출` 탭을 그리는가 — 본인 보고서에서만 */
  withSubmit: boolean;
};

const TAB_BASE =
  "min-h-9 whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";
const TAB_ACTIVE =
  "border-vermilion bg-vermilion/10 font-semibold text-vermilion";
const TAB_IDLE = "border-transparent text-ink hover:bg-line-soft";

/**
 * 왼쪽 볼 것 칸의 영역 탭 — 링크가 아니라 버튼이고 주소의 `tab` 만 바꾼다(서버 왕복 없음).
 * 키보드는 SubTabs 와 같다: 선택 탭만 Tab 순서에 들고 ←→·Home·End 가 선택과 포커스를 함께 옮긴다.
 */
export function AreaTabs({ withSubmit }: Props) {
  const { area: raw, setArea } = useOpsArea();
  const area = visibleArea(raw, withSubmit);
  const keys: readonly ReportTab[] = withSubmit ? REPORT_TABS : AREA_TABS;
  const refs = useRef(new Map<ReportTab, HTMLButtonElement>());

  function select(key: ReportTab) {
    if (key !== area) setArea(key);
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const next = neighbour(e.key, index, keys.length - 1);
    if (next === null) return;
    e.preventDefault();
    const key = keys[next];
    select(key);
    refs.current.get(key)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="영역"
      className="flex gap-1 overflow-x-auto border-b border-line-soft"
    >
      {keys.map((key, i) => {
        const selected = key === area;
        return (
          <button
            key={key}
            ref={(el) => {
              if (el) refs.current.set(key, el);
              else refs.current.delete(key);
            }}
            type="button"
            role="tab"
            id={`area-tab-${key}`}
            aria-controls={`area-panel-${key}`}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={`${TAB_BASE} ${selected ? TAB_ACTIVE : TAB_IDLE}`}
            onClick={() => {
              select(key);
            }}
            onKeyDown={(e) => {
              onKeyDown(e, i);
            }}
          >
            {key === "submit" ? SUBMIT_TAB_TITLE : AREA_TAB_TITLE[key]}
          </button>
        );
      })}
    </div>
  );
}
