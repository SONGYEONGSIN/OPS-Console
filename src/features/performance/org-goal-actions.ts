"use server";
import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { orgGoalUpsertSchema } from "./org-goal-schema";

export type OrgGoalResult = { ok: true; id: string } | { ok: false; error: string };

const REVALIDATE = "/dashboard/outcomes";

/**
 * 조직 목표 등록·수정 — **admin 만**.
 *
 * 목표 하나가 팀 전체의 달성률을 좌우한다. 화면이 admin 에게만 보이더라도
 * 서버가 폼을 믿지 않고 여기서 다시 막는다(오픈안내 설정과 같은 사정).
 */
export async function upsertOrgGoal(input: unknown): Promise<OrgGoalResult> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: "admin만 등록할 수 있습니다" };
  }
  const parsed = orgGoalUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }
  const { id, ...values } = parsed.data;

  const admin = createAdminClient();
  const row = {
    ...values,
    created_by: me.email,
    updated_at: new Date().toISOString(),
  };
  const q = id
    ? admin.from("performance_org_goals").update(row).eq("id", id).select("id")
    : admin.from("performance_org_goals").insert(row).select("id");
  const { data, error } = await q.maybeSingle();
  if (error) return { ok: false, error: error.message };
  // 수정 대상이 사라졌는데 성공으로 돌려주면 화면이 저장된 줄 안다.
  if (!data) return { ok: false, error: "대상 목표를 찾지 못했습니다" };

  revalidatePath(REVALIDATE);
  return { ok: true, id: (data as { id: string }).id };
}

/** 조직 목표 삭제 — admin 만. */
export async function deleteOrgGoal(id: string): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (me?.permission !== "admin") {
    return { ok: false, error: "admin만 삭제할 수 있습니다" };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("performance_org_goals")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(REVALIDATE);
  return { ok: true };
}
