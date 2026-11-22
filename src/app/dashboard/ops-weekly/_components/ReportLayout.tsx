"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import type { Area } from "@/features/ops-weekly/constants";
import {
  AREA_TABS,
  isPanelArea,
  type AreaTab,
  type PanelArea,
} from "../_params";
import { ROW_BTN_CLASS } from "./styles";
import { AreaTabs } from "./AreaTabs";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 확인한 영역 — 영역 탭 라벨 뒤에 ✓ */
  checked: readonly Area[];
  /** 영역별 본문 — 넷 다 마운트하고 지금 영역만 보인다 */
  areas: Record<AreaTab, ReactNode>;
  /** 오른쪽 쓸 것 칸(특이사항·직접 추가) — [특이사항] 으로 연다 */
  panel: ReactNode;
  /** 영역 탭 줄 오른쪽, [특이사항] 옆에 놓을 지금 영역의 버튼([이 영역 확인]) */
  actions?: Partial<Record<PanelArea, ReactNode>> | null;
  /** 남의 보고서를 보는 중이면 영역 탭 위 제목 `{이름}의 보고서` 와 제출 현황으로 돌아가는 링크 */
  heading?: { name: string; backHref: string } | null;
};

// 7rem = 셸 상단바 52px + 하단바 27px + 여백 (InspectorPanel 의 md:top-[52px] md:bottom-[27px])
const ASIDE_STICKY =
  "lg:sticky lg:top-[calc(var(--ops-kpi-h,0px)+1rem)] lg:max-h-[calc(100dvh-var(--ops-kpi-h,0px)-7rem)] lg:overflow-y-auto lg:border-l lg:border-line-soft lg:pl-7";

const TOGGLE_BASE = `${ROW_BTN_CLASS} whitespace-nowrap`;
const TOGGLE_ON = "border-ink bg-ink text-cream";

/**
 * 내 보고서 — 영역 탭 + 본문이 전체 폭이고, [특이사항] 을 누르면 오른쪽 쓸 것 칸이 열린다(lg 이상 두 칸, 미만은 위에 쌓임).
 * 쓸 것 칸은 닫혀도 언마운트하지 않는다(쓰던 글 보존). 프로젝트·TF 탭은 특이사항이 본문 안이라 버튼·칸이 없다.
 */
export function ReportLayout({
  checked,
  areas,
  panel,
  actions = null,
  heading = null,
}: Props) {
  const { area } = useOpsArea();
  const [open, setOpen] = useState(false);
  const panelArea = isPanelArea(area) ? area : null;
  const shown = open && panelArea !== null;

  return (
    <div
      className={`flex flex-col gap-4 p-5 lg:gap-7 lg:p-7 ${
        shown
          ? "lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start"
          : ""
      }`}
    >
      <div className="min-w-0">
        {heading !== null ? (
          // 돌아가기는 제목 바로 위 — 보는 대상(제목)과 나가는 길이 한 자리에 있고, 머리띠의 주 이동과 섞이지 않는다.
          <div className="mb-4 flex flex-col gap-1">
            <Link
              href={heading.backHref}
              className="self-start text-xs text-ink-soft underline hover:text-vermilion"
            >
              ‹ 제출 현황
            </Link>
            <h2 className="text-xl font-bold text-ink">{`${heading.name}의 보고서`}</h2>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b border-line-soft">
          <AreaTabs checked={checked} />
          {panelArea !== null ? (
            <div className="flex flex-wrap items-center gap-2 pb-1.5">
              <button
                type="button"
                aria-expanded={shown}
                aria-controls="ops-write-panel"
                className={`${TOGGLE_BASE} ${shown ? TOGGLE_ON : ""}`}
                onClick={() => {
                  setOpen((v) => !v);
                }}
              >
                특이사항
              </button>
              {actions?.[panelArea] ?? null}
            </div>
          ) : null}
        </div>
        {AREA_TABS.map((k) => (
          <div
            key={k}
            role="tabpanel"
            id={`area-panel-${k}`}
            aria-labelledby={`area-tab-${k}`}
            hidden={k !== area}
            className="pt-5"
          >
            {areas[k]}
          </div>
        ))}
      </div>
      <aside
        id="ops-write-panel"
        aria-label="쓸 것"
        hidden={!shown}
        // 좁은 화면에서는 열면 목록 위에 온다 — 누른 버튼 바로 아래에서 쓰기 시작한다.
        className={`min-w-0 max-lg:-order-1 ${ASIDE_STICKY}`}
      >
        {panel}
      </aside>
    </div>
  );
}
