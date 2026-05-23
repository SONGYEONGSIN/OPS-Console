"use client";

import { useState } from "react";
import { useDashboardRealtime } from "./use-dashboard-realtime";
import { INITIAL_CONSOLE_LINES, type ConsoleLogEntry } from "./mock-log-pool";

const CONSOLE_CAP = 50;

/** 실시간 현황 사이드바 state hook — Supabase Realtime 기반 콘솔 lines 관리. */
export function useLiveSidebar(
  opts: {
    initialLines?: ConsoleLogEntry[];
    mine?: boolean;
    myEmail?: string | null;
  } = {},
) {
  const { mine = false, myEmail = null } = opts;
  const [lines, setLines] = useState<ConsoleLogEntry[]>(
    opts.initialLines && opts.initialLines.length > 0
      ? opts.initialLines
      : INITIAL_CONSOLE_LINES,
  );

  useDashboardRealtime({
    mine,
    myEmail,
    onConsoleLine: (line) => {
      setLines((prev) => {
        const next = [...prev, line];
        return next.length > CONSOLE_CAP
          ? next.slice(next.length - CONSOLE_CAP)
          : next;
      });
    },
  });

  return { lines };
}
