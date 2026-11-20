"use client";

import { useState, type ReactNode } from "react";
import type { Area } from "@/features/ops-weekly/constants";
import { AREA_TABS, type AreaTab } from "../_params";
import { AreaTabs } from "./AreaTabs";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 확인한 영역 — 영역 탭 라벨 뒤에 ✓ */
  checked: readonly Area[];
  /** 영역별 본문 — 셋 다 마운트하고 지금 영역만 보인다 */
  areas: Record<AreaTab, ReactNode>;
  /** 오른쪽 쓸 것 칸 */
  panel: ReactNode;
};

type View = "list" | "write";

const VIEWS: readonly { key: View; label: string }[] = [
  { key: "list", label: "목록" },
  { key: "write", label: "쓰기" },
];

const TOGGLE_BASE =
  "min-h-9 border px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";
const TOGGLE_ON = "border-ink bg-ink text-cream";
const TOGGLE_OFF =
  "border-line-soft text-ink-soft hover:border-ink hover:bg-ink hover:text-cream";

// 7rem = 셸 상단바 52px + 하단바 27px + 여백 (InspectorPanel 의 md:top-[52px] md:bottom-[27px])
const ASIDE_STICKY =
  "lg:sticky lg:top-[calc(var(--ops-kpi-h,0px)+1rem)] lg:max-h-[calc(100dvh-var(--ops-kpi-h,0px)-7rem)] lg:overflow-y-auto lg:border-l lg:border-line-soft lg:pl-7";

/**
 * 내 보고서 두 칸 — 왼쪽 볼 것(영역 탭 + 본문), 오른쪽 쓸 것.
 * lg 미만에서는 [목록 | 쓰기] 로 한 칸씩 보인다. 안 보이는 칸도 언마운트하지 않는다(쓰던 글 보존).
 */
export function ReportLayout({ checked, areas, panel }: Props) {
  const { area } = useOpsArea();
  const [view, setView] = useState<View>("list");

  return (
    <div className="flex flex-col gap-4 p-5 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-7 lg:p-7">
      <div
        role="group"
        aria-label="보기 전환"
        className="flex gap-1 lg:hidden"
      >
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            aria-pressed={view === key}
            className={`${TOGGLE_BASE} ${view === key ? TOGGLE_ON : TOGGLE_OFF}`}
            onClick={() => {
              setView(key);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className={`min-w-0 ${view === "write" ? "max-lg:hidden" : ""}`}>
        <AreaTabs checked={checked} />
        {AREA_TABS.map((k) => (
          <div
            key={k}
            role="tabpanel"
            id={`area-panel-${k}`}
            aria-labelledby={`area-tab-${k}`}
            hidden={k !== area}
          >
            {areas[k]}
          </div>
        ))}
      </div>
      <aside
        aria-label="쓸 것"
        className={`min-w-0 ${view === "list" ? "max-lg:hidden" : ""} ${ASIDE_STICKY}`}
      >
        {panel}
      </aside>
    </div>
  );
}
