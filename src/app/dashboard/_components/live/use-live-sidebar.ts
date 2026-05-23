"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

/** 실시간 현황 사이드바 state hook — sim 토글 + 콘솔 lines + 토스트 트리거. */
export function useLiveSidebar(opts: { initialLines?: ConsoleLogEntry[] } = {}) {
  const { showToast } = useToast();
  const [sim, setSim] = useState(false);
  const [lines, setLines] = useState<ConsoleLogEntry[]>(
    opts.initialLines && opts.initialLines.length > 0
      ? opts.initialLines
      : INITIAL_CONSOLE_LINES,
  );
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const triggerEvent = useCallback(() => {
    const log = pickRandom(LOG_POOL);
    setLines((prev) => {
      const next = [...prev, log];
      return next.length > CONSOLE_CAP
        ? next.slice(next.length - CONSOLE_CAP)
        : next;
    });
    showToast(pickRandom(TOAST_MESSAGE_POOL));
  }, [showToast]);

  const onToggleSim = useCallback(() => {
    setSim((prev) => {
      if (!prev) triggerEvent();
      return !prev;
    });
  }, [triggerEvent]);

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

  return {
    sim,
    lines,
    onToggleSim,
    onTestEvent: triggerEvent,
  };
}
