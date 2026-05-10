"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import {
  scheduleEventCreateSchema,
  scheduleEventUpdateSchema,
  type ScheduleEventRow,
} from "./schemas";

export type ScheduleActionResult =
  | { ok: true; row: ScheduleEventRow }
  | { ok: false; error: string };

const PERMISSION_ERROR_VIEWER = "권한 없음 — 일정 작성 권한이 없습니다.";
const PERMISSION_ERROR_TARGET = "권한 없음 — 본인 또는 본인이 담당자인 일정만 편집할 수 있습니다.";
const NOT_FOUND_ERROR = "일정을 찾을 수 없습니다.";

const SCHEDULE_PATH = "/dashboard/schedule";

function canCreate(me: CurrentOperator | null): boolean {
  if (!me) return false;
  if (me.permission === "viewer" || me.permission === null) return false;
  return true;
}

/**
 * 일정 편집 권한.
 * - admin: 모든 일정
 * - member: 본인이 created_by 또는 assignee인 일정만
 * - viewer / null: 차단
 */
export function canEditScheduleEvent(
  target: { created_by_email: string; assignee_email: string | null },
  me: CurrentOperator | null,
): boolean {
  if (!me) return false;
  if (me.permission === "viewer" || me.permission === null) return false;
  if (me.permission === "admin") return true;
  if (target.created_by_email === me.email) return true;
  if (target.assignee_email && target.assignee_email === me.email) return true;
  return false;
}

export async function createScheduleEvent(
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = scheduleEventCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!canCreate(me)) {
    return { ok: false, error: PERMISSION_ERROR_VIEWER };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(SCHEDULE_PATH);
  return { ok: true, row: data as ScheduleEventRow };
}

export async function updateScheduleEvent(
  id: string,
  input: unknown,
): Promise<ScheduleActionResult> {
  const parsed = scheduleEventUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("schedule_events")
    .select("created_by_email, assignee_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (
    !canEditScheduleEvent(
      {
        created_by_email: target.created_by_email,
        assignee_email: target.assignee_email,
      },
      me,
    )
  ) {
    return { ok: false, error: PERMISSION_ERROR_TARGET };
  }

  const { data, error } = await supabase
    .from("schedule_events")
    .update(parsed.data)
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath(SCHEDULE_PATH);
  return { ok: true, row: data as ScheduleEventRow };
}

export async function deleteScheduleEvent(
  id: string,
): Promise<ScheduleActionResult> {
  const me = await getCurrentOperator();
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("schedule_events")
    .select("created_by_email, assignee_email")
    .eq("id", id)
    .maybeSingle();
  if (!target) return { ok: false, error: NOT_FOUND_ERROR };

  if (
    !canEditScheduleEvent(
      {
        created_by_email: target.created_by_email,
        assignee_email: target.assignee_email,
      },
      me,
    )
  ) {
    return { ok: false, error: PERMISSION_ERROR_TARGET };
  }

  const { data, error } = await supabase
    .from("schedule_events")
    .delete()
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  revalidatePath(SCHEDULE_PATH);
  return { ok: true, row: data as ScheduleEventRow };
}
