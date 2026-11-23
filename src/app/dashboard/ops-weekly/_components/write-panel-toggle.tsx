"use client";

import { createContext, useContext, type ReactNode } from "react";
import { BTN_CLASS } from "./styles";

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

const TOGGLE_ON = "border-ink bg-ink text-cream";

/** 표 바로 위 오른쪽 [특이사항] — 기본 버튼 모양. 쓸 것 칸이 없는 화면(Provider 밖)에서는 그리지 않는다. */
export function WritePanelToggle() {
  const ctx = useContext(WritePanelToggleContext);
  if (ctx === null) return null;
  return (
    <div className="flex justify-end">
      <button
        type="button"
        aria-expanded={ctx.open}
        aria-controls="ops-write-panel"
        className={`${BTN_CLASS} whitespace-nowrap ${ctx.open ? TOGGLE_ON : ""}`}
        onClick={ctx.toggle}
      >
        특이사항
      </button>
    </div>
  );
}
