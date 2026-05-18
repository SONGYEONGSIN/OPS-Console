"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import {
  handoverRecordUpsertSchema,
  type HandoverRecordRow,
  type HandoverStatus,
} from "./schemas";
import { HANDOVER_FIELD_KEYS } from "./categories";

export type UpsertResult =
  | { ok: true; row: HandoverRecordRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";

/**
 * service_id 기준 upsert (unique constraint). 14 필드 patch.
 * status 자동:
 *  - 14 필드 모두 비었으면 draft
 *  - 1개 이상 채움 → draft
 *  - 14 필드 모두 채움 → ready
 *  (published는 PR-B에서 handover_progress completed 시 별도 갱신)
 */
export async function upsertHandoverRecord(
  input: unknown,
): Promise<UpsertResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = handoverRecordUpsertSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const allFilled = HANDOVER_FIELD_KEYS.every((k) => {
    const v = parsed.data[k];
    return v != null && String(v).trim().length > 0;
  });
  const status: HandoverStatus = allFilled ? "ready" : "draft";

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_records")
    .upsert(
      {
        ...parsed.data,
        author_email: me.email,
        author_name: me.displayName ?? me.email,
        status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "service_id" },
    )
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "handover",
    action: "upsert",
    target_type: "handover_records",
    target_id: parsed.data.service_id,
    msg: `인수인계 내용 저장 (status=${status})`,
    metadata: {
      status,
      filledCount: HANDOVER_FIELD_KEYS.filter((k) => parsed.data[k]).length,
    },
  });

  revalidatePath("/dashboard/handover");
  revalidatePath(`/dashboard/handover/${parsed.data.service_id}`);
  return { ok: true, row: data as HandoverRecordRow };
}
