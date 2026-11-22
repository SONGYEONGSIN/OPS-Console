"use client";

import { useRef, type KeyboardEvent } from "react";
import type { Area } from "@/features/ops-weekly/constants";
import { AREA_TABS, AREA_TAB_TITLE, type AreaTab } from "../_params";
import { neighbour } from "./SubTabs";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 확인한 영역 — 라벨 뒤에 ✓ */
  checked: readonly Area[];
};

const TAB_BASE =
  "min-h-9 whitespace-nowrap border-b-2 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";
const TAB_ACTIVE =
  "border-vermilion bg-vermilion/10 font-semibold text-vermilion";
const TAB_IDLE = "border-transparent text-ink hover:bg-line-soft";

/** 프로젝트·TF 탭은 확인 영역 둘(project·tf)을 담아 둘 다 확인해야 ✓ 다. */
function isChecked(key: AreaTab, checked: readonly Area[]): boolean {
  return key === "project"
    ? checked.includes("project") && checked.includes("tf")
    : checked.includes(key);
}

/**
 * 왼쪽 볼 것 칸의 영역 탭 — 링크가 아니라 버튼이고 주소의 `tab` 만 바꾼다(서버 왕복 없음).
 * 키보드는 SubTabs 와 같다: 선택 탭만 Tab 순서에 들고 ←→·Home·End 가 선택과 포커스를 함께 옮긴다.
 */
export function AreaTabs({ checked }: Props) {
  const { area, setArea } = useOpsArea();
  const refs = useRef(new Map<AreaTab, HTMLButtonElement>());

  function select(key: AreaTab) {
    if (key !== area) setArea(key);
  }

  function onKeyDown(e: KeyboardEvent, index: number) {
    const next = neighbour(e.key, index, AREA_TABS.length - 1);
    if (next === null) return;
    e.preventDefault();
    const key = AREA_TABS[next];
    select(key);
    refs.current.get(key)?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label="영역"
      className="flex gap-1 overflow-x-auto border-b border-line-soft"
    >
      {AREA_TABS.map((key, i) => {
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
            {AREA_TAB_TITLE[key]}
            {isChecked(key, checked) ? " ✓" : ""}
          </button>
        );
      })}
    </div>
  );
}
