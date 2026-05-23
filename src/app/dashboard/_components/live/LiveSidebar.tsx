"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SystemHealthPanel } from "./SystemHealthPanel";
import { ConsoleStream } from "./ConsoleStream";
import { AdminControls } from "./AdminControls";
import { useToast } from "./ToastContainer";
import {
  INITIAL_CONSOLE_LINES,
  LOG_POOL,
  TOAST_MESSAGE_POOL,
  pickRandom,
  type ConsoleLogEntry,
} from "./mock-log-pool";

const CONSOLE_CAP = 50;
const SIM_INTERVAL_MS = 6000;

/** 우측 사이드바 — 헬스 패널 + 콘솔 + 관리자 컨트롤. sim state + interval + 토스트 트리거. */
export function LiveSidebar() {
  const { showToast } = useToast();
  const [sim, setSim] = useState(false);
  const [lines, setLines] = useState<ConsoleLogEntry[]>(INITIAL_CONSOLE_LINES);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerEvent = useCallback(() => {
    const log = pickRandom(LOG_POOL);
    setLines((prev) => {
      const next = [...prev, log];
      return next.length > CONSOLE_CAP ? next.slice(next.length - CONSOLE_CAP) : next;
    });
    showToast(pickRandom(TOAST_MESSAGE_POOL));
  }, [showToast]);

  useEffect(() => {
    if (!sim) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    intervalRef.current = setInterval(triggerEvent, SIM_INTERVAL_MS);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [sim, triggerEvent]);

  /** sim 토글: ON 전환 시 즉시 1회 인입 후 interval 시작. */
  const handleToggleSim = useCallback(() => {
    setSim((prev) => {
      if (!prev) triggerEvent();
      return !prev;
    });
  }, [triggerEvent]);

  return (
    <aside className="flex flex-col gap-6">
      <SystemHealthPanel cronActive={sim} />
      <ConsoleStream lines={lines} />
      <AdminControls
        sim={sim}
        onToggleSim={handleToggleSim}
        onTestEvent={triggerEvent}
      />
    </aside>
  );
}
