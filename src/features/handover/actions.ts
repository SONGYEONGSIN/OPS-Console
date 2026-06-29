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
import { isHandoverRecordComplete } from "./completion";

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

  // status는 UI 배지(progress.ts isFieldFilled)와 동일 규칙으로 판정 —
  // 구조화 필드(계약정보·정산·학교담당자 등)는 구조화 데이터로 완료 여부를 본다.
  const status: HandoverStatus = isHandoverRecordComplete(parsed.data)
    ? "ready"
    : "draft";

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

  // 목록만 revalidate — 편집기 라우트(/dashboard/handover/[serviceId])는
  // 자동저장마다 RSC 소프트 리프레시를 일으키므로 제외(편집 중 리렌더 최소화).
  // 편집기 작성상태 배지는 클라이언트가 응답(res.row.status)으로 직접 갱신한다.
  revalidatePath("/dashboard/handover");
  return { ok: true, row: data as HandoverRecordRow };
}

export type CopyResult =
  | { ok: true; copiedCount: number }
  | { ok: false; error: string };

/**
 * fromServiceId의 인수인계 14필드를 toServiceIds 각각에 복제 (덮어쓰기 upsert).
 * 1차 서비스 작성 후 2차·3차 등 다른 차수에 동일 내용 복사하는 용도.
 */
export async function copyHandoverRecord(
  fromServiceId: string,
  toServiceIds: string[],
): Promise<CopyResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };
  if (!fromServiceId) return { ok: false, error: "원본 서비스 누락" };
  const targets = toServiceIds.filter((id) => id && id !== fromServiceId);
  if (targets.length === 0)
    return { ok: false, error: "복제 대상 서비스를 선택하세요." };

  const supabase = await createClient();

  // 원본 14필드 읽기
  const { data: src, error: srcErr } = await supabase
    .from("handover_records")
    .select(HANDOVER_FIELD_KEYS.join(","))
    .eq("service_id", fromServiceId)
    .maybeSingle();
  if (srcErr) return { ok: false, error: srcErr.message };
  if (!src) return { ok: false, error: "원본 인수인계 내용이 없습니다." };

  const srcRec = src as unknown as Record<string, string | null>;
  const allFilled = HANDOVER_FIELD_KEYS.every((k) => {
    const v = srcRec[k];
    return v != null && String(v).trim().length > 0;
  });
  const status: HandoverStatus = allFilled ? "ready" : "draft";
  const now = new Date().toISOString();

  const payload = targets.map((service_id) => {
    const fields: Record<string, string | null> = {};
    for (const k of HANDOVER_FIELD_KEYS) fields[k] = srcRec[k] ?? null;
    return {
      ...fields,
      service_id,
      author_email: me.email,
      author_name: me.displayName ?? me.email,
      status,
      updated_at: now,
    };
  });

  const { error } = await supabase
    .from("handover_records")
    .upsert(payload, { onConflict: "service_id" });
  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "handover",
    action: "copy",
    target_type: "handover_records",
    target_id: fromServiceId,
    msg: `인수인계 내용 복제 (${targets.length}개 서비스로)`,
    metadata: { from: fromServiceId, to: targets, status },
  });

  revalidatePath("/dashboard/handover");
  return { ok: true, copiedCount: targets.length };
}
