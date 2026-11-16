import "server-only";

/**
 * 자동 목록 원천 조회 — 운영자 한 명의 주간 스냅샷을 만든다.
 * supabase-js 는 쿼리 실패를 던지지 않는다. 에러는 여기서 던져, 빈 목록으로 삼키지 않는다.
 * 시각 필터 값은 전부 `toISOString()` 문자열이다(Date 를 넘기면 PostgREST 가 못 읽는다).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { phaseOf } from "@/features/closing/phase";
import {
  buildApplicationGroups,
  countUnmatchedApplication,
  sameName,
  type ClosingLite,
} from "./auto-lists/application";
import {
  buildLeaveItems,
  type BackupLeaveLite,
  type ScheduleLeaveLite,
} from "./auto-lists/leave";
import {
  buildPimsGroups,
  countUnmatchedPims,
  type PimsLite,
} from "./auto-lists/pims";
import { freshDevStages, type DevStatusRow } from "./dev-status";
import type { AutoSnapshot } from "./merge";
import { referenceInstant, shiftWeek, weekWindows } from "./week";

const CLOSING_COLUMNS =
  "service_id, university_name, service_name, operator_name, write_start_at, write_end_at, pay_end_at";
const PIMS_COLUMNS =
  "service_id, university_name, service_name, operator_name, last_announce_at";
const BACKUP_COLUMNS =
  "id, leave_type, leave_start_date, leave_end_date, substitute_name";
const SCHEDULE_COLUMNS = "id, type, title, start_at, end_at, assignee_email";

type QueryResult = {
  data: unknown[] | null;
  error: { message: string } | null;
};

function rowsOf<T>(label: string, res: QueryResult): T[] {
  if (res.error) throw new Error(`[ops-weekly] ${label}: ${res.error.message}`);
  if (res.data === null) {
    throw new Error(`[ops-weekly] ${label}: 응답이 비었다`);
  }
  return res.data as T[];
}

export async function listDevStatuses(
  serviceIds: readonly number[],
): Promise<DevStatusRow[]> {
  if (serviceIds.length === 0) return [];
  const res = await createAdminClient()
    .from("ops_weekly_dev_status")
    .select("service_id, stage, collected_at")
    .in("service_id", [...serviceIds]);
  return rowsOf<DevStatusRow>("ops_weekly_dev_status", res);
}

export async function loadAutoSnapshot(args: {
  weekStart: string;
  operatorEmail: string;
  operatorName: string;
  writerNames: ReadonlySet<string>;
  now: Date;
}): Promise<AutoSnapshot> {
  const { weekStart, now } = args;
  const operatorName = args.operatorName.trim();
  const operatorEmail = args.operatorEmail.trim().toLowerCase();
  const writerNames = new Set([...args.writerNames].map((n) => n.trim()));
  const win = weekWindows(weekStart);
  const startIso = win.startInstant.toISOString();
  const endIso = weekWindows(shiftWeek(weekStart, 1)).endInstant.toISOString();
  const db = createAdminClient();

  const [closingRes, pimsRes, backupRes, scheduleRes] = await Promise.all([
    db
      .from("closing_services")
      .select(CLOSING_COLUMNS)
      .or(`pay_end_at.is.null,pay_end_at.gte.${startIso}`),
    db
      .from("announcement_services")
      .select(PIMS_COLUMNS)
      .gte("last_announce_at", startIso)
      .lte("last_announce_at", endIso),
    db
      .from("backup_requests")
      .select(BACKUP_COLUMNS)
      .eq("requester_email", operatorEmail)
      .lte("leave_start_date", win.nextWeek.endYmd),
    db
      .from("schedule_events")
      .select(SCHEDULE_COLUMNS)
      .in("type", ["leave", "external_meeting", "training"])
      .lte("start_at", endIso)
      .or(`end_at.is.null,end_at.gte.${startIso}`),
  ]);
  const closing = rowsOf<ClosingLite>("closing_services", closingRes);
  const pims = rowsOf<PimsLite>("announcement_services", pimsRes);
  const backups = rowsOf<BackupLeaveLite>("backup_requests", backupRes);
  const schedules = rowsOf<ScheduleLeaveLite>(
    "schedule_events",
    scheduleRes,
  ).map((s) => ({
    ...s,
    assignee_email: s.assignee_email?.trim().toLowerCase() ?? null,
  }));

  const ref = referenceInstant(weekStart, now);
  const upcomingIds = closing
    .filter(
      (r) =>
        sameName(r.operator_name, operatorName) &&
        phaseOf(r, ref) === "upcoming",
    )
    .map((r) => r.service_id);
  const devStages = freshDevStages(
    await listDevStatuses(upcomingIds),
    weekStart,
  );

  return {
    version: 1,
    computedAt: now.toISOString(),
    application: buildApplicationGroups({
      rows: closing,
      operatorName,
      devStages,
      weekStart,
      now,
    }),
    pims: buildPimsGroups({ rows: pims, operatorName, weekStart }),
    leave: buildLeaveItems({
      backups,
      schedules,
      operatorEmail,
      operatorName,
      weekStart,
    }),
    unmatched: {
      application: countUnmatchedApplication({
        rows: closing,
        writerNames,
        weekStart,
        now,
      }),
      pims: countUnmatchedPims({ rows: pims, writerNames, weekStart }),
    },
  };
}
