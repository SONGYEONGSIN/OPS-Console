import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  checklistItemRowSchema,
  type ChecklistItemRow,
} from "./checklist-schemas";

/**
 * cohort 단위 체크리스트 row fetch.
 * 가이드 콘텐츠(_content.ts) 모든 항목에 대해 row가 존재하지 않을 수 있다
 * — toggle 시점에 upsert로 생성되므로, 미존재 항목은 미체크로 간주.
 */
export async function listChecklistByCohort(
  cohortId: string,
): Promise<ChecklistItemRow[]> {
  if (!cohortId) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_checklist_items")
    .select("*")
    .eq("cohort_id", cohortId);

  if (error) {
    console.error("[listChecklistByCohort] supabase error:", error);
    return [];
  }

  const parsed: ChecklistItemRow[] = [];
  for (const row of data ?? []) {
    const r = checklistItemRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listChecklistByCohort] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}

/**
 * 모든 회차의 체크리스트 row를 한 번에 fetch (RLS가 사용자별 가시 범위로 스코프).
 * 회차 관리 탭 인스펙터에서 회차별 체크 상태를 그룹화해 표시하기 위함.
 */
export async function listAllChecklists(): Promise<ChecklistItemRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("onboarding_checklist_items")
    .select("*");

  if (error) {
    console.error("[listAllChecklists] supabase error:", error);
    return [];
  }

  const parsed: ChecklistItemRow[] = [];
  for (const row of data ?? []) {
    const r = checklistItemRowSchema.safeParse(row);
    if (r.success) parsed.push(r.data);
    else
      console.error(
        "[listAllChecklists] zod parse fail:",
        r.error.issues,
        "row:",
        row,
      );
  }
  return parsed;
}
