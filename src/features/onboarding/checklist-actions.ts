"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import {
  checklistToggleSchema,
  type ChecklistItemRow,
} from "./checklist-schemas";

const COHORT_PATH = "/dashboard/onboarding";
const PERMISSION_ERROR =
  "권한 없음 — 본인 회차의 체크리스트만 토글할 수 있습니다.";
const NOT_FOUND_ERROR = "회차를 찾을 수 없습니다.";

export type ChecklistToggleResult =
  | { ok: true; row: ChecklistItemRow }
  | { ok: false; error: string };

/**
 * 체크리스트 항목 토글 (upsert).
 *
 * 권한 모델:
 * - 본인 회차(cohort.trainee_email = me.email): 본인 진행 자유롭게 토글
 * - admin: 모든 회차 토글 (사수 보조 입력 허용)
 * - 그 외(mentor 포함): 차단
 *
 * RLS도 동일 정책으로 백업하지만, server action에서도 명시 차단해 즉시 피드백.
 */
export async function toggleChecklistItem(
  input: unknown,
): Promise<ChecklistToggleResult> {
  const parsed = checklistToggleSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const me = await getCurrentOperator();
  if (!me?.email) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  const supabase = await createClient();

  // cohort 소속 확인 (본인 회차인가) — admin은 우회
  const { data: cohort, error: cohortError } = await supabase
    .from("onboarding_cohorts")
    .select("id, trainee_email")
    .eq("id", parsed.data.cohort_id)
    .maybeSingle();
  if (cohortError) return { ok: false, error: cohortError.message };
  if (!cohort) return { ok: false, error: NOT_FOUND_ERROR };

  const isOwn = cohort.trainee_email === me.email;
  const isAdmin = me.permission === "admin";
  if (!isOwn && !isAdmin) {
    return { ok: false, error: PERMISSION_ERROR };
  }

  // upsert — unique (cohort_id, section_key, item_key)
  const { data, error } = await supabase
    .from("onboarding_checklist_items")
    .upsert(
      {
        cohort_id: parsed.data.cohort_id,
        section_key: parsed.data.section_key,
        item_key: parsed.data.item_key,
        checked: parsed.data.checked,
        // checked_at은 트리거가 자동 갱신
      },
      { onConflict: "cohort_id,section_key,item_key" },
    )
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    level: "INFO",
    domain: "onboarding",
    action: parsed.data.checked ? "check" : "uncheck",
    target_type: "checklist_item",
    target_id: data.id,
    target_name: `${parsed.data.section_key} / ${parsed.data.item_key}`,
    msg: `체크리스트 ${parsed.data.checked ? "체크" : "해제"} — ${parsed.data.item_key}`,
  });

  revalidatePath(COHORT_PATH);
  return { ok: true, row: data as ChecklistItemRow };
}
