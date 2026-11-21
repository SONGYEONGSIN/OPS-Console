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
  listUnmatchedApplication,
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
  listUnmatchedPims,
  type PimsLite,
} from "./auto-lists/pims";
import type { UnmatchedServices } from "./auto-lists/unmatched";
import { normEmail } from "./email";
import { freshDevStages, type DevStatusRow } from "./dev-status";
import type { AutoSnapshot } from "./merge";
import { referenceInstant, shiftWeek, weekWindows } from "./week";

const CLOSING_COLUMNS =
  "service_id, university_name, service_name, operator_name, write_start_at, write_end_at, pay_end_at, university_type, category";
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

/** PostgREST Max-Rows — 한 번만 읽으면 1000행에서 조용히 잘린다. */
const CHUNK = 1000;
const MAX_PAGES = 20;

/**
 * 결제 마감 전 마감 서비스 전부. '시작 전' 묶음은 시작일 상한이 없어 쿼리를 좁힐 수 없고
 * `closing_services` 는 지우지 않는 미러라 1000행을 넘는다 — 쪽으로 끝까지 읽는다.
 * 쪽 상한을 다 채우면 던진다(잘린 목록이 본인 서비스 누락·안 붙음 과소집계로 굳는다).
 */
async function listOpenClosing(
  db: ReturnType<typeof createAdminClient>,
  startIso: string,
): Promise<ClosingLite[]> {
  const out: ClosingLite[] = [];
  for (let p = 0; p < MAX_PAGES; p++) {
    const res = await db
      .from("closing_services")
      .select(CLOSING_COLUMNS)
      .or(`pay_end_at.is.null,pay_end_at.gte.${startIso}`)
      .order("service_id", { ascending: true })
      .range(p * CHUNK, p * CHUNK + CHUNK - 1);
    const page = rowsOf<ClosingLite>("closing_services", res);
    out.push(...page);
    if (page.length < CHUNK) return out;
  }
  throw new Error(
    `[ops-weekly] closing_services: ${MAX_PAGES * CHUNK}행을 넘어 끝까지 읽지 못했다`,
  );
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

/**
 * 그 주(월 00:00 KST 이후)에 구분 수집이 한 번이라도 돌았는가 — 사람과 무관한 전역 사실.
 * 기준은 `freshDevStages` 와 같은 `collected_at ≥ 주 시작`. 에러는 던진다('수집 안 됨' 으로 삼키지 않는다).
 */
async function devStatusCollectedSince(
  db: ReturnType<typeof createAdminClient>,
  startIso: string,
): Promise<boolean> {
  const res = await db
    .from("ops_weekly_dev_status")
    .select("service_id")
    .gte("collected_at", startIso)
    .limit(1);
  return (
    rowsOf<{ service_id: number }>("ops_weekly_dev_status", res).length > 0
  );
}

/** 작성 명단 이름 — 공백을 맞춘다. 스냅샷의 안 붙음 개수와 설정 탭 목록이 같은 규칙을 쓴다. */
function trimmedNames(names: ReadonlySet<string>): Set<string> {
  return new Set([...names].map((n) => n.trim()));
}

/**
 * 그 주의 원천 행 — 마감 서비스 전부와 금주·차주 발표.
 * 스냅샷(안 붙음 개수)과 설정 탭 목록이 둘 다 이 함수를 거쳐 기간 창·쿼리가 갈라질 수 없다.
 */
async function loadWeekSources(
  db: ReturnType<typeof createAdminClient>,
  weekStart: string,
): Promise<{ closing: ClosingLite[]; pims: PimsLite[] }> {
  const startIso = weekWindows(weekStart).startInstant.toISOString();
  const endIso = weekWindows(shiftWeek(weekStart, 1)).endInstant.toISOString();
  const [closing, pimsRes] = await Promise.all([
    listOpenClosing(db, startIso),
    db
      .from("announcement_services")
      .select(PIMS_COLUMNS)
      .gte("last_announce_at", startIso)
      .lte("last_announce_at", endIso),
  ]);
  return {
    closing,
    pims: rowsOf<PimsLite>("announcement_services", pimsRes),
  };
}

type WeekInputs = {
  closing: ClosingLite[];
  pims: PimsLite[];
  devStatusCollected: boolean;
  backups: (BackupLeaveLite & { requester_email: string })[];
  schedules: ScheduleLeaveLite[];
};

/** 사람과 무관한 그 주 원천 + 백업 요청(요청자 이메일 목록으로 좁힌다). */
async function loadWeekInputs(
  weekStart: string,
  requesterEmails: readonly string[],
): Promise<WeekInputs> {
  const win = weekWindows(weekStart);
  const startIso = win.startInstant.toISOString();
  const endIso = weekWindows(shiftWeek(weekStart, 1)).endInstant.toISOString();
  const db = createAdminClient();
  const [sources, devStatusCollected, backupRes, scheduleRes] =
    await Promise.all([
      loadWeekSources(db, weekStart),
      devStatusCollectedSince(db, startIso),
      db
        .from("backup_requests")
        .select(`${BACKUP_COLUMNS}, requester_email`)
        .in("requester_email", [...requesterEmails])
        .lte("leave_start_date", win.nextWeek.endYmd),
      db
        .from("schedule_events")
        .select(SCHEDULE_COLUMNS)
        .in("type", ["leave", "external_meeting", "training"])
        .lte("start_at", endIso)
        .or(`end_at.is.null,end_at.gte.${startIso}`),
    ]);
  const schedules = rowsOf<ScheduleLeaveLite>(
    "schedule_events",
    scheduleRes,
  ).map((s) => ({
    ...s,
    assignee_email: s.assignee_email ? normEmail(s.assignee_email) : null,
  }));
  return {
    ...sources,
    devStatusCollected,
    backups: rowsOf<BackupLeaveLite & { requester_email: string }>(
      "backup_requests",
      backupRes,
    ),
    schedules,
  };
}

type Writer = { email: string; name: string };

function upcomingIdsOf(
  closing: readonly ClosingLite[],
  operatorName: string,
  ref: Date,
): number[] {
  return closing
    .filter(
      (r) =>
        sameName(r.operator_name, operatorName) &&
        phaseOf(r, ref) === "upcoming",
    )
    .map((r) => r.service_id);
}

function buildSnapshot(args: {
  inputs: WeekInputs;
  writer: Writer;
  writerNames: ReadonlySet<string>;
  devStages: ReturnType<typeof freshDevStages>;
  weekStart: string;
  now: Date;
}): AutoSnapshot {
  const { inputs, writer, writerNames, devStages, weekStart, now } = args;
  const { closing, pims } = inputs;
  return {
    version: 1,
    computedAt: now.toISOString(),
    application: buildApplicationGroups({
      rows: closing,
      operatorName: writer.name,
      devStages,
      devStatusCollected: inputs.devStatusCollected,
      weekStart,
      now,
    }),
    pims: buildPimsGroups({ rows: pims, operatorName: writer.name, weekStart }),
    leave: buildLeaveItems({
      backups: inputs.backups.filter(
        (b) => normEmail(b.requester_email) === writer.email,
      ),
      schedules: inputs.schedules,
      operatorEmail: writer.email,
      operatorName: writer.name,
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

export async function loadAutoSnapshot(args: {
  weekStart: string;
  operatorEmail: string;
  operatorName: string;
  writerNames: ReadonlySet<string>;
  now: Date;
}): Promise<AutoSnapshot> {
  const map = await loadAutoSnapshots({
    weekStart: args.weekStart,
    writers: [{ email: args.operatorEmail, name: args.operatorName }],
    writerNames: args.writerNames,
    now: args.now,
  });
  const snap = map.get(normEmail(args.operatorEmail));
  if (snap === undefined) throw new Error("[ops-weekly] 스냅샷을 만들지 못했다");
  return snap;
}

/**
 * 여러 작성자의 스냅샷을 한 번에 — 원천(마감·발표·일정·백업·구분)은 한 번만 읽는다.
 * 키는 정규화한 이메일. 전체 보고가 쓰고, 한 사람 스냅샷(`loadAutoSnapshot`)도 이 길을 탄다.
 */
export async function loadAutoSnapshots(args: {
  weekStart: string;
  writers: readonly Writer[];
  writerNames: ReadonlySet<string>;
  now: Date;
}): Promise<Map<string, AutoSnapshot>> {
  const { weekStart, now } = args;
  const writers = args.writers.map((w) => ({
    email: normEmail(w.email),
    name: w.name.trim(),
  }));
  const writerNames = trimmedNames(args.writerNames);
  const inputs = await loadWeekInputs(
    weekStart,
    writers.map((w) => w.email),
  );
  const ref = referenceInstant(weekStart, now);
  const upcoming = [
    ...new Set(writers.flatMap((w) => upcomingIdsOf(inputs.closing, w.name, ref))),
  ];
  const devStages = freshDevStages(await listDevStatuses(upcoming), weekStart);
  return new Map(
    writers.map((writer) => [
      writer.email,
      buildSnapshot({ inputs, writer, writerNames, devStages, weekStart, now }),
    ]),
  );
}

/**
 * 안 붙은 서비스 목록 — 설정 탭이 보는 주 기준 실시간 값.
 * 스냅샷의 `unmatched` 개수와 같은 `listUnmatched…` 판정을 쓴다(개수 = 목록 길이).
 */
export async function loadUnmatchedServices(args: {
  weekStart: string;
  writerNames: ReadonlySet<string>;
  now: Date;
}): Promise<UnmatchedServices> {
  const { weekStart, now } = args;
  const writerNames = trimmedNames(args.writerNames);
  const { closing, pims } = await loadWeekSources(createAdminClient(), weekStart);
  return {
    application: listUnmatchedApplication({
      rows: closing,
      writerNames,
      weekStart,
      now,
    }),
    pims: listUnmatchedPims({ rows: pims, writerNames, weekStart }),
  };
}
