"use client";

import { markTabChecked } from "@/features/ops-weekly/actions";
import type { Area } from "@/features/ops-weekly/constants";
import { ERROR_CLASS, ROW_BTN_CLASS } from "./styles";
import { useSave } from "./use-save";

type Props = {
  reportId: string;
  area: Area;
  /** 이미 확인한 영역 — 다시 누를 일이 없어 꺼 둔다(확인 취소는 없다) */
  checked: boolean;
};

/** 영역 탭 줄 오른쪽 [이 영역 확인] — 쓸 것 칸을 열지 않고도 확인한다. 다섯 영역을 다 확인해야 제출된다. */
export function AreaCheckButton({ reportId, area, checked }: Props) {
  const check = useSave();
  return (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={checked || check.pending}
        className={`${ROW_BTN_CLASS} whitespace-nowrap disabled:cursor-default disabled:text-muted disabled:hover:border-line-soft disabled:hover:bg-transparent disabled:hover:text-muted`}
        onClick={() => {
          check.run(() => markTabChecked({ reportId, area }));
        }}
      >
        {checked ? "확인함 ✓" : "이 영역 확인"}
      </button>
      {check.error !== null ? (
        <span role="alert" className={ERROR_CLASS}>
          {check.error}
        </span>
      ) : null}
    </span>
  );
}
