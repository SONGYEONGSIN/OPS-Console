"use client";

import { useRef, type ReactNode } from "react";
import { STICKY_TITLE_CLASS, TITLE_HEIGHT_VAR } from "./styles";
import { useHeightVar } from "./use-height-var";

/**
 * 표 제목 줄 — lg 이상에서 영역 탭 줄 아래에 붙고, 제 높이를 부모의 `--ops-title-h` 로 알린다.
 * 그 아래 표 머리줄(STICKY_THEAD_CLASS)이 이 높이만큼 더 내려와 붙는다.
 */
export function StickyTitle(props: {
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useHeightVar(ref, TITLE_HEIGHT_VAR);
  return (
    <div ref={ref} className={`${props.className ?? ""} ${STICKY_TITLE_CLASS}`}>
      {props.children}
    </div>
  );
}
