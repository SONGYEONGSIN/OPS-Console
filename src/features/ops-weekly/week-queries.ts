import "server-only";

/**
 * 주·작성 명단 조회 — admin client, 에러가 나면 던진다.
 * supabase-js 는 쿼리 실패를 던지지 않는다. 빈 결과로 삼키면 빈 명단으로 [최종 보고]가 켜진다.
 *
 * 주가 열리는 시점: 늦어도 그 주 월 00:00 KST 다(그 주에 처음 들어오는 사람의 접근이 만든다).
 * 직전 주가 보고되는 순간 `finalizeWeek` 가 `ensureWeek(next)` 를 부른다(Task 9).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { WRITER_TEAMS } from "./constants";
import { normEmail } from "./email";
import { dutyForWeek, writerRoster, type WriterCandidate } from "./roster";
import { weekRowSchema, type WeekRow } from "./schemas";
import { canCreateWeek, weekOf, weekRefFromStart } from "./week";

type DbError = { message: string } | null;

/** 목록 응답: 에러·null 을 모두 던진다. */
export function rowsOf<T>(
  label: string,
  res: { data: unknown[] | null; error: DbError },
): T[] {
  if (res.error) throw new Error(`[ops-weekly] ${label}: ${res.error.message}`);
  if (res.data === null) {
    throw new Error(`[ops-weekly] ${label}: 응답이 비었다`);
  }
  return res.data as T[];
}

/** 단건 응답(maybeSingle): 에러는 던지고, 행이 없는 null 은 정상이다. */
export function rowOf<T>(
  label: string,
  res: { data: unknown; error: DbError },
): T | null {
  if (res.error) throw new Error(`[ops-weekly] ${label}: ${res.error.message}`);
  return (res.data as T | null) ?? null;
}

/** 쓰기 응답: 에러만 본다(데이터 없는 upsert/insert/update 는 data 가 null 이다). */
export function assertWritten(label: string, res: { error: DbError }): void {
  if (res.error) throw new Error(`[ops-weekly] ${label}: ${res.error.message}`);
}

type Settings = {
  rotation_anchor_week: string | null;
  excluded_writer_emails: string[];
};

async function loadSettings(): Promise<Settings> {
  const res = await createAdminClient()
    .from("ops_weekly_settings")
    .select("rotation_anchor_week, excluded_writer_emails")
    .eq("id", true)
    .maybeSingle();
  const row = rowOf<Partial<Settings>>("ops_weekly_settings", res);
  return {
    rotation_anchor_week: row?.rotation_anchor_week ?? null,
    excluded_writer_emails: row?.excluded_writer_emails ?? [],
  };
}

export async function getWeek(weekStart: string): Promise<WeekRow | null> {
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  const row = rowOf<unknown>("ops_weekly_weeks", res);
  return row === null ? null : weekRowSchema.parse(row);
}

/** 최근 주부터 `limit` 개(week_start 내림차순). 전체 현황 표가 쓴다. */
export async function listRecentWeeks(limit: number): Promise<WeekRow[]> {
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(limit);
  return rowsOf<unknown>("ops_weekly_weeks", res).map((r) =>
    weekRowSchema.parse(r),
  );
}

export async function getWeekById(weekId: string): Promise<WeekRow | null> {
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .select("*")
    .eq("id", weekId)
    .maybeSingle();
  const row = rowOf<unknown>("ops_weekly_weeks", res);
  return row === null ? null : weekRowSchema.parse(row);
}

/** 작성 명단. `listOperators` 를 쓰지 않는다 — 그쪽은 에러를 `[]` 로 삼킨다. */
export async function listWriters(): Promise<WriterCandidate[]> {
  const res = await createAdminClient()
    .from("operators")
    .select("email, name, team, role, status")
    .in("team", [...WRITER_TEAMS])
    .eq("status", "active");
  // 이메일은 여기서 한 번 소문자로 맞춘다 — 이후 보고서 키(operator_email)와 같은 값이 된다.
  const rows = rowsOf<WriterCandidate>("operators", res).map((r) => ({
    ...r,
    email: normEmail(r.email),
  }));
  const settings = await loadSettings();
  return writerRoster(rows, settings.excluded_writer_emails.map(normEmail));
}

async function dutyFor(weekStart: string): Promise<string | null> {
  const settings = await loadSettings();
  if (settings.rotation_anchor_week === null) return null;
  const res = await createAdminClient()
    .from("ops_weekly_duty_rotation")
    .select("position, operator_email")
    .order("position", { ascending: true });
  const rotation = rowsOf<{ operator_email: string }>(
    "ops_weekly_duty_rotation",
    res,
  ).map((r) => r.operator_email);
  return dutyForWeek(weekStart, rotation, settings.rotation_anchor_week);
}

async function fillDuty(existing: WeekRow): Promise<WeekRow> {
  if (existing.duty_email !== null) return existing;
  const duty = await dutyFor(existing.week_start);
  if (duty === null) return existing;
  // 그 사이 admin 이 당번을 바꿨다면 덮어쓰지 않는다(비어 있을 때만 쓴다).
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .update({ duty_email: duty })
    .eq("id", existing.id)
    .is("duty_email", null);
  assertWritten("ops_weekly_weeks", res);
  return (await getWeek(existing.week_start)) ?? existing;
}

/**
 * 주 행을 돌려준다(없으면 만든다). 만들 수 없는 주(월요일 아님·과거·보고 전의 다음 주)는 null.
 * 동시에 첫 접근이 와도 `week_start` unique 와 ignoreDuplicates 로 행은 하나이고, upsert 뒤 다시 읽는다.
 */
export async function ensureWeek(
  weekStart: string,
  now: Date = new Date(),
): Promise<WeekRow | null> {
  const ref = weekRefFromStart(weekStart);
  if (ref === null) return null;
  const existing = await getWeek(weekStart);
  if (existing) return fillDuty(existing);

  const current = weekOf(now).weekStart;
  const currentWeek = current === weekStart ? null : await getWeek(current);
  if (!canCreateWeek(weekStart, now, currentWeek?.status === "reported")) {
    return null;
  }
  const res = await createAdminClient()
    .from("ops_weekly_weeks")
    .upsert(
      {
        week_start: weekStart,
        label_year: ref.year,
        label_month: ref.month,
        label_week: ref.week,
        duty_email: await dutyFor(weekStart),
      },
      { onConflict: "week_start", ignoreDuplicates: true },
    );
  assertWritten("ops_weekly_weeks", res);
  const created = await getWeek(weekStart);
  if (created === null) {
    throw new Error(
      "[ops-weekly] ops_weekly_weeks: 만든 주를 다시 읽지 못했다",
    );
  }
  return created;
}
