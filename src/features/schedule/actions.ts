"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import type { CurrentOperator } from "@/features/auth/queries";
import {
  scheduleEventCreateSchema,
  scheduleEventUpdateSchema,
  type ScheduleEventRow,
} from "./schemas";
import { canEditScheduleEvent } from "./permission";

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
