"use client";

import type { ReactNode } from "react";
import { AREA_TABS, AREA_TAB_LABEL, type AreaTab } from "../_params";
import { useOpsArea } from "./use-ops-area";

type Props = {
  /** 영역별 특이사항 칸 */
  notes: Record<AreaTab, ReactNode>;
  /** 영역별 직접 추가 칸 */
  directAdd?: Record<AreaTab, ReactNode> | null;
  projects?: ReactNode;
  submit?: ReactNode;
};

function PerArea({
  slots,
  area,
}: {
  slots: Record<AreaTab, ReactNode>;
  area: AreaTab;
}) {
  return (
    <>
      {AREA_TABS.map((k) => (
        <div key={k} hidden={k !== area}>
          {slots[k]}
        </div>
      ))}
    </>
  );
}

/**
 * 쓸 것 칸 — 위에서부터 특이사항 → 직접 추가 → 프로젝트·TF → 제출.
 * 영역별 칸은 왼쪽 영역을 따라 바뀌되 셋 다 마운트한 채 `hidden` 으로 가린다(쓰던 글 보존).
 */
export function WritePanel({ notes, directAdd, projects, submit }: Props) {
  const { area } = useOpsArea();
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm font-bold text-ink">{AREA_TAB_LABEL[area]}</p>
      <section aria-label="특이사항">
        <PerArea slots={notes} area={area} />
      </section>
      {directAdd ? (
        <section aria-label="직접 추가">
          <PerArea slots={directAdd} area={area} />
        </section>
      ) : null}
      {projects ? <section aria-label="프로젝트·TF">{projects}</section> : null}
      {submit ? (
        <section aria-label="제출" className="empty:hidden">
          {submit}
        </section>
      ) : null}
    </div>
  );
}
