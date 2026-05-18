import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  worklogInsertSchema,
  type WorklogInsert,
} from "./schemas";

/**
 * 활동 로그 단건 insert. server action 결과 OK 후 호출.
 *
 * - service_role(admin client)로 RLS 우회 — UI에서 직접 변조 불가
 * - 실패해도 throw 안 함 (로깅이 도메인 액션을 막아선 안 됨) — 콘솔만 출력
 * - user_email/user_name은 자동으로 현재 로그인 사용자에서 채움 (없으면 null)
 */
export async function logActivity(input: WorklogInsert): Promise<void> {
  const parsed = worklogInsertSchema.safeParse(input);
  if (!parsed.success) {
    console.error(
      "[worklog] invalid payload:",
      parsed.error.issues,
      "input:",
      input,
    );
    return;
  }

  try {
    const me = await getCurrentOperator();
    const admin = createAdminClient();
    const { error } = await admin.from("worklog").insert({
      level: parsed.data.level ?? "INFO",
      user_email: me?.email ?? null,
      user_name: me?.displayName ?? null,
      domain: parsed.data.domain,
      action: parsed.data.action,
      target_type: parsed.data.target_type ?? null,
      target_id: parsed.data.target_id ?? null,
      target_name: parsed.data.target_name ?? null,
      msg: parsed.data.msg,
      metadata: parsed.data.metadata ?? null,
    });
    if (error) {
      console.error("[worklog] insert fail:", error.message, "input:", input);
    }
  } catch (e) {
    console.error("[worklog] unexpected error:", e);
  }
}
