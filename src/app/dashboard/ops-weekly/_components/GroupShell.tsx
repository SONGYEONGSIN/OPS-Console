"use client";

import { useState, type ReactNode } from "react";
import type { AutoArea } from "@/features/ops-weekly/constants";
import { ManualItemForm } from "./ManualItemForm";
import { BTN_CLASS } from "./styles";

type Props = {
  title: string;
  /** 자동 + 직접 건수 */
  count: number;
  /** 주면 머리 오른쪽에 [+ 직접 추가] 가 생기고, 누르면 폼이 목록 아래에 열린다 */
  add: {
    reportId: string;
    area: AutoArea;
    groupKey: string | null;
    leave?: boolean;
  } | null;
  children: ReactNode;
};

/**
 * 묶음 한 칸 — 상자 없이 제목 밑줄로 가른다. [+ 직접 추가] 는 하위 묶음의 보조 액션이라
 * 헤더 액션(vermilion)이 아니라 BTN_CLASS 다 — 탭 하나에 묶음이 여섯이라 주 액션이 여섯이 되면 안 된다.
 */
export function GroupShell({ title, count, add, children }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <section className="flex flex-col">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-line pb-2">
        <h3 className="text-sm font-bold text-ink">{title}</h3>
        <span className="text-xs tabular-nums text-muted">{`${count}건`}</span>
        {add !== null ? (
          <button
            type="button"
            aria-expanded={open}
            className={`${BTN_CLASS} ml-auto`}
            onClick={() => setOpen(!open)}
          >
            + 직접 추가
          </button>
        ) : null}
      </div>
      {children}
      {add !== null && open ? (
        <ManualItemForm {...add} onClose={() => setOpen(false)} />
      ) : null}
    </section>
  );
}
