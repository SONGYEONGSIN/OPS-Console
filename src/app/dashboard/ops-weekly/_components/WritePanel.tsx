"use client";

import type { ReactNode } from "react";
import {
  AREA_TABS,
  AREA_TAB_TITLE,
  hasWritePanel,
  type AreaTab,
  type PanelArea,
} from "../_params";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 영역별 특이사항 칸 — 프로젝트·TF 탭은 프로젝트·TF 특이사항 둘 */
  notes: Record<AreaTab, ReactNode>;
  /** 영역별 직접 추가 칸 — 자동 목록이 있는 셋에만 */
  directAdd?: Partial<Record<PanelArea, ReactNode>> | null;
};

function PerArea({
  slots,
  area,
}: {
  slots: Partial<Record<AreaTab, ReactNode>>;
  area: AreaTab | null;
}) {
  return (
    <>
      {AREA_TABS.map((k) =>
        slots[k] === undefined ? null : (
          <div key={k} hidden={k !== area}>
            {slots[k]}
          </div>
        ),
      )}
    </>
  );
}

/**
 * 쓸 것 칸 — 특이사항 → 직접 추가. 제출 탭에는 없다.
 * 영역별 칸은 왼쪽 영역을 따라 바뀌되 모두 마운트한 채 `hidden` 으로 가린다(쓰던 글 보존).
 */
export function WritePanel({ notes, directAdd }: Props) {
  const { area } = useOpsArea();
  const shown = hasWritePanel(area) ? area : null;
  return (
    <div className="flex flex-col gap-5">
      {shown !== null ? (
        <p className="text-sm font-bold text-ink">{AREA_TAB_TITLE[shown]}</p>
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
