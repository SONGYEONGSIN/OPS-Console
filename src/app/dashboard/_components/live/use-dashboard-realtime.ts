"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "./ToastContainer";
import {
  formatWorklogConsoleLine,
  formatIncidentToast,
  formatTodoToast,
  formatBackupRequestToast,
  formatDataRequestSendToast,
  formatHandoverToast,
} from "./realtime-event-formatters";
import type { ConsoleLogEntry } from "./mock-log-pool";

type Args = {
  mine: boolean;
  myEmail: string | null;
  onConsoleLine: (line: ConsoleLogEntry) => void;
};

/** Supabase Realtime 채널 구독 — worklog/incidents/todos/backup_requests/data_request_sends.
 *  - worklog INSERT → 콘솔 push (mine 필터 적용)
 *  - 4 도메인 INSERT/UPDATE → 토스트 (mine 필터 적용)
 *  unmount 시 채널 정리. */
export function useDashboardRealtime({ mine, myEmail, onConsoleLine }: Args) {
  const { showToast } = useToast();
  // ref를 render-time에 직접 쓰지 않고 useEffect 내부에서만 읽도록 유지.
  const onConsoleLineRef = useRef(onConsoleLine);
  useEffect(() => {
    onConsoleLineRef.current = onConsoleLine;
  });

  useEffect(() => {
    const supabase = createClient();
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // worklog → console
    const worklogCh = supabase
      .channel("realtime:worklog")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "worklog" },
        (payload) => {
          const row = payload.new as {
            level: string;
            domain: string;
            msg: string;
            user_email?: string;
          };
          if (mine && myEmail && row.user_email !== myEmail) return;
          onConsoleLineRef.current(formatWorklogConsoleLine(row));
        },
      )
      .subscribe();
    channels.push(worklogCh);

    // incidents INSERT → toast
    const incCh = supabase
      .channel("realtime:incidents")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "incidents" },
        (payload) => {
          const row = payload.new as {
            title: string;
            owner_email?: string | null;
          };
          if (mine && myEmail && row.owner_email !== myEmail) return;
          const t = formatIncidentToast(row);
          showToast(t.text);
        },
      )
      .subscribe();
    channels.push(incCh);

    // todos INSERT → toast
    const todoCh = supabase
      .channel("realtime:todos")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "todos" },
        (payload) => {
          const row = payload.new as {
            title: string;
            owner_email?: string | null;
          };
          if (mine && myEmail && row.owner_email !== myEmail) return;
          showToast(formatTodoToast(row).text);
        },
      )
      .subscribe();
    channels.push(todoCh);

    // backup_requests INSERT → toast
    const bkCh = supabase
      .channel("realtime:backup_requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "backup_requests" },
        (payload) => {
          const row = payload.new as {
            summary_md: string;
            requester_email: string;
          };
          if (mine && myEmail && row.requester_email !== myEmail) return;
          showToast(formatBackupRequestToast(row).text);
        },
      )
      .subscribe();
    channels.push(bkCh);

    // data_request_sends UPDATE → toast (sent/failed 만)
    const drsCh = supabase
      .channel("realtime:data_request_sends")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "data_request_sends" },
        (payload) => {
          const row = payload.new as {
            university_name: string;
            status: string;
            created_by_email: string;
          };
          if (mine && myEmail && row.created_by_email !== myEmail) return;
          const t = formatDataRequestSendToast(row);
          if (t) showToast(t.text);
        },
      )
      .subscribe();
    channels.push(drsCh);

    // handover_records INSERT → toast
    const hoCh = supabase
      .channel("realtime:handover_records")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "handover_records" },
        (payload) => {
          const row = payload.new as {
            author_name: string;
            author_email: string;
            service_id: string;
          };
          if (mine && myEmail && row.author_email !== myEmail) return;
          showToast(formatHandoverToast(row).text);
        },
      )
      .subscribe();
    channels.push(hoCh);

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [mine, myEmail, showToast]);
}
