"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { APP_SUBS, PIMS_SUBS, parseSub, type SubTabArea } from "../_params";
import { useOpsSub } from "./use-ops-sub";

export type SubTabItem = {
  key: string;
  label: string;
  /** null 이면 `—` (집계할 수 없는 값) */
  count: number | null;
};

type Props = {
  tab: SubTabArea;
  ariaLabel: string;
  tabs: readonly SubTabItem[];
  /** 키 → 패널. 늘 마운트한다 — 입력 중인 폼·저장 대기 등록이 탭을 오가도 남는다. */
  panels: Record<string, ReactNode>;
};

const TAB_BASE =
  "shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-xs min-h-9 lg:min-h-0 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ink";
const TAB_ACTIVE = "border-vermilion font-semibold text-vermilion";
const TAB_IDLE = "border-transparent text-ink-soft hover:text-ink";

/** 하위 탭 줄 id — KPI 카드가 전환 뒤 이 줄로 스크롤한다. */
export const SUB_TABS_ID = "ops-subtabs";

function neighbour(key: string, index: number, last: number): number | null {
  if (key === "ArrowRight") return index === last ? 0 : index + 1;
  if (key === "ArrowLeft") return index === 0 ? last : index - 1;
  if (key === "Home") return 0;
  if (key === "End") return last;
  return null;
}

/**
 * 탭 안 하위 탭 — PageTabs `size="sm"` 밑줄 줄과 같은 모양인데 링크가 아니라 버튼이다(주소만 `sub` 로 바꾼다).
 * 선택은 URL(`?sub=`)이고 고르면 바로 활성화된다. 패널은 `hidden` 속성만 토글해 늘 마운트해 둔다.
 */
export function SubTabs({ tab, ariaLabel, tabs, panels }: Props) {
  const { raw, setSub } = useOpsSub();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const keys = tabs.map((t) => t.key);
  const known: readonly string[] = tab === "application" ? APP_SUBS : PIMS_SUBS;
  const active = parseSub(
    tab,
    raw,
    keys.filter((k) => known.includes(k)),
  );

  function onKeyDown(e: KeyboardEvent, index: number) {
    const next = neighbour(e.key, index, keys.length - 1);
    if (next === null) return;
    e.preventDefault();
    setSub(keys[next]);
    refs.current.get(keys[next])?.focus();
  }

  return (
    <div className="flex flex-col gap-6">
      <div
        id={SUB_TABS_ID}
        className="border-b border-line-soft lg:scroll-mt-36"
      >
        <div
          role="tablist"
          aria-label={ariaLabel}
          className="-mb-px flex gap-1 overflow-x-auto"
        >
          {tabs.map((t, i) => {
            const isActive = t.key === active;
            return (
              <button
                key={t.key}
                ref={(el) => {
                  if (el) refs.current.set(t.key, el);
                  else refs.current.delete(t.key);
                }}
                type="button"
                role="tab"
                id={`sub-tab-${t.key}`}
                aria-controls={`sub-panel-${t.key}`}
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className={`${TAB_BASE} ${isActive ? TAB_ACTIVE : TAB_IDLE}`}
                onClick={() => {
                  setSub(t.key);
                }}
                onKeyDown={(e) => {
                  onKeyDown(e, i);
                }}
              >
                {t.label}
                <span
                  className={`ml-1 tabular-nums ${isActive ? "" : "text-muted"}`}
                >
                  {t.count === null ? "—" : t.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((t) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`sub-panel-${t.key}`}
          aria-labelledby={`sub-tab-${t.key}`}
          hidden={t.key !== active}
        >
          {panels[t.key]}
        </div>
      ))}
    </div>
  );
}
