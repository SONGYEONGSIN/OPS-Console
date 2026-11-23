"use client";

import type { ReactNode } from "react";
import {
  AREA_TAB_LABEL,
  PANEL_AREAS,
  isPanelArea,
  type PanelArea,
} from "../_params";
import { useOpsArea } from "./use-ops-area";

type Slots = Record<PanelArea, ReactNode>;

type Props = {
  /** 영역별 특이사항 칸 */
  notes: Slots;
  /** 영역별 직접 추가 칸 */
  directAdd?: Slots | null;
};

function PerArea({ slots, area }: { slots: Slots; area: PanelArea | null }) {
  return (
    <>
      {PANEL_AREAS.map((k) => (
        <div key={k} hidden={k !== area}>
          {slots[k]}
        </div>
      ))}
    </>
  );
}

/**
 * 쓸 것 칸 — 특이사항 → 직접 추가. 프로젝트·TF 는 영역 탭, 제출은 제출 탭에 있다.
 * 영역별 칸은 왼쪽 영역을 따라 바뀌되 셋 다 마운트한 채 `hidden` 으로 가린다(쓰던 글 보존).
 */
export function WritePanel({ notes, directAdd }: Props) {
  const { area } = useOpsArea();
  const shown = isPanelArea(area) ? area : null;
  return (
    <div className="flex flex-col gap-5">
      {shown !== null ? (
        <p className="text-sm font-bold text-ink">{AREA_TAB_LABEL[shown]}</p>
      ) : null}
      <section aria-label="특이사항">
        <PerArea slots={notes} area={shown} />
      </section>
      {directAdd ? (
        <section aria-label="직접 추가">
          <PerArea slots={directAdd} area={shown} />
        </section>
      ) : null}
    </div>
  );
}
