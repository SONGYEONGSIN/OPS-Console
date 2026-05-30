"use client";

import type { ComponentPropsWithoutRef, MouseEvent } from "react";

type Props = Omit<ComponentPropsWithoutRef<"input">, "type"> & {
  /** 날짜 종류 — 기본 'date'. 예약 시각 등은 'datetime-local'. */
  type?: "date" | "datetime-local";
};

/**
 * 날짜/시각 input — 칸 어디를 클릭해도 캘린더 picker 노출.
 *
 * 기본 <input type="date"/"datetime-local">는 Chrome에서 우측 아이콘 영역만
 * picker를 트리거하는 UX 한계가 있다. showPicker()를 클릭 핸들러에서 호출하여
 * input 전체 영역이 활성 클릭 타겟이 되도록 처리.
 *
 * - 미지원 브라우저(Safari < 16 등)는 native 동작으로 fallback (try/catch)
 * - 호출자가 onClick을 넘기면 showPicker 후 사용자 핸들러도 체이닝 호출
 */
export function DateInput(props: Props) {
  const { onClick, type = "date", ...rest } = props;
  return (
    <input
      {...rest}
      type={type}
      onClick={(e: MouseEvent<HTMLInputElement>) => {
        try {
          e.currentTarget.showPicker?.();
        } catch {
          /* InvalidStateError 등 가드 — native 동작 유지 */
        }
        onClick?.(e);
      }}
    />
  );
}
