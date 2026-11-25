"use server";

/**
 * 사고 등급 기준 저장 — admin 만. 폼(모달)에서 부른다.
 * server action 은 라우트 가드가 없어 세션과 admin 여부를 매번 다시 읽는다.
 * 리다이렉트하는 requireAdmin() 을 쓰지 않는다 — 모달 저장이 페이지 이동이 되기 때문이다.
 * 기준 표는 authenticated 에 select 만 열려 있어 쓰기는 service_role 로 한다.
 */
import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { logActivity } from "@/features/worklog/log";
import { SEVERITY_VALUES, severityCriteriaSchema } from "./schemas";

export type SeverityCriteriaActionResult =
  { ok: true } | { ok: false; error: string };

const PATH = "/dashboard/incidents";

export async function updateSeverityCriteria(
  input: unknown,
): Promise<SeverityCriteriaActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다." };
  if (me.permission !== "admin") {
    return { ok: false, error: "관리자만 기준을 고칠 수 있습니다." };
  }

  const parsed = severityCriteriaSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  const rows = SEVERITY_VALUES.map((severity) => ({
    severity,
    description: parsed.data[severity],
    updated_by: me.email,
  }));
  const { error } = await createAdminClient()
    .from("incident_severity_criteria")
    .upsert(rows, { onConflict: "severity" });
  if (error) {
    return { ok: false, error: `기준 저장에 실패했습니다: ${error.message}` };
  }

  await logActivity({
    domain: "incidents",
    action: "update",
    target_type: "incident_severity_criteria",
    target_name: "사고 등급 기준",
    msg: "사고 등급 기준 수정",
  });

  revalidatePath(PATH);
  return { ok: true };
}
