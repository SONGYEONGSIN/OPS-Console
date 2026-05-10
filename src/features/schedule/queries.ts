import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  scheduleEventRowSchema,
  type ScheduleEventRow,
} from "./schemas";

/**
 * schedule_events fetch (RSC).
 * RLS: authenticated → 모든 row read 허용 (팀 공통 일정 공유).
 * 정렬: start_at asc (가까운 일정 위).
 */
export async function listScheduleEvents(): Promise<ScheduleEventRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) {
    console.error("[listScheduleEvents] supabase error:", error);
    return [];
  }

  const parsed: ScheduleEventRow[] = [];
  for (const row of data ?? []) {
    const r = scheduleEventRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listScheduleEvents] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

export async function getScheduleEventById(
  id: string,
): Promise<ScheduleEventRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("schedule_events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  const r = scheduleEventRowSchema.safeParse(data);
  return r.success ? r.data : null;
}
