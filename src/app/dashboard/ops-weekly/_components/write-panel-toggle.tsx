"use client";

import { createContext, useContext, type ReactNode } from "react";
import { HEADER_ACTION_CLASS } from "@/components/common/HeaderActionButton";

type Toggle = { open: boolean; toggle: () => void };

const WritePanelToggleContext = createContext<Toggle | null>(null);

/** 쓸 것 칸의 열림 상태는 ReportLayout 이 갖고, 버튼은 각 영역 본문(표 바로 위)이 그린다. */
export function WritePanelToggleProvider(
  props: Toggle & { children: ReactNode },
) {
  const { open, toggle, children } = props;
  return (
    <WritePanelToggleContext.Provider value={{ open, toggle }}>
      {children}
    </WritePanelToggleContext.Provider>
  );
}

/**
 * 제목 줄 오른쪽 끝 [특이사항] — 목록 제목 오른쪽 액션 표준(HEADER_ACTION_CLASS, 제출완료 와 같은 색·크기).
 * 표준은 모양이 하나뿐이라 열림 표시는 aria-expanded 와 열린 칸이 한다.
 * 쓸 것 칸이 없는 화면(Provider 밖)에서는 그리지 않는다.
 */
export function WritePanelToggle() {
  const ctx = useContext(WritePanelToggleContext);
  if (ctx === null) return null;
  return (
    <button
      type="button"
      aria-expanded={ctx.open}
      aria-controls="ops-write-panel"
      className={`${HEADER_ACTION_CLASS} ml-auto shrink-0 self-center whitespace-nowrap`}
      onClick={ctx.toggle}
    >
      특이사항
    </button>
  );
}
