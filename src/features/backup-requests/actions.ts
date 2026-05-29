"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import {
  backupRequestCreateSchema,
  backupRequestUpdateSchema,
  type BackupRequestRow,
} from "./schemas";
import { parseScheduledAtKst } from "./schedule-time";

export type BackupRequestActionResult =
  | { ok: true; row: BackupRequestRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const BACKUP_PATH = "/dashboard/backup";

export async function createBackupRequest(
  input: unknown,
): Promise<BackupRequestActionResult> {
  const me = await getCurrentOperator();
  if (!me) {
    return { ok: false, error: AUTH_ERROR };
  }

  // self 차단을 위해 requester_email을 zod 입력에 포함시켜 cross-field 검증
  const inputWithContext =
    typeof input === "object" && input !== null
      ? { ...input, requester_email: me.email }
      : input;

  const parsed = backupRequestCreateSchema.safeParse(inputWithContext);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  // PR-6: 예약 모드 분기 — scheduledAt 파싱 + mail_status='scheduled' 적재.
  // 즉시 모드는 기존 흐름 (mail_status default 'pending', mail은 page.tsx onPersist에서 발송).
  let scheduledAtIso: string | null = null;
  let initialMailStatus: "pending" | "scheduled" = "pending";
  if (parsed.data.mode === "schedule") {
    const when = parseScheduledAtKst(parsed.data.scheduledAt ?? "");
    if (!when) {
      return { ok: false, error: "예약 시각 형식이 잘못되었습니다" };
    }
    if (when.getTime() <= Date.now()) {
      return { ok: false, error: "예약 시각은 현재보다 미래여야 합니다" };
    }
    scheduledAtIso = when.toISOString();
    initialMailStatus = "scheduled";
  }

  const supabase = await createClient();
  // PR-2: services 컬럼 drop됨. join은 backup_request_services 테이블로 별도 insert.
  // PR-4: top-level contacts 제거 (서비스로 이전).
  const payload = {
    requester_email: me.email,
    requester_team: me.team ?? null,
    substitute_email: parsed.data.substitute_email,
    substitute_name: parsed.data.substitute_name,
    title: parsed.data.title?.trim() || null,
    summary_md: parsed.data.summary_md,
    leave_type: parsed.data.leave_type ?? null,
    leave_start_date: parsed.data.leave_start_date ?? null,
    leave_end_date: parsed.data.leave_end_date ?? null,
    mail_status: initialMailStatus,
    scheduled_at: scheduledAtIso,
  };

  const { data, error } = await supabase
    .from("backup_requests")
    .insert(payload)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  const parent = data as BackupRequestRow;

  if (parsed.data.services.length > 0) {
    // PR-3: 서비스별 substitute_email/name. 미지정 시 default(backup_requests.substitute_*)로 fallback.
    // PR-4: 서비스별 contacts/note_md 추가. 미지정 시 빈 배열/null.
    const joinRows = parsed.data.services.map((s) => ({
      backup_request_id: parent.id,
      service_id: s.service_id,
      substitute_email: s.substitute_email ?? parsed.data.substitute_email,
      substitute_name: s.substitute_name ?? parsed.data.substitute_name,
      contacts: s.contacts,
      note_md: s.note_md ?? null,
    }));
    const { error: joinErr } = await supabase
      .from("backup_request_services")
      .insert(joinRows);
    if (joinErr) {
      console.error("[createBackupRequest] join insert fail:", joinErr);
      return {
        ok: false,
        error: `services FK 저장 실패: ${joinErr.message}`,
      };
    }
  }

  revalidatePath(BACKUP_PATH);
  return { ok: true, row: parent };
}

/**
 * PR-7: 백업 요청 수정 — 본인 row 또는 admin만 (RLS 강제).
 * services_detail 교체 전략: 기존 backup_request_services 모두 삭제 후 신규 insert.
 * mail_status / scheduled_at / 메일 발송 트리거는 본 함수에서 변경하지 않음.
 * 메일 재발송이 필요하면 운영자가 명시적으로 재발송 버튼을 사용한다 (정책 결정).
 */
export async function updateBackupRequest(
  id: string,
  input: unknown,
): Promise<BackupRequestActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = backupRequestUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const patch: Record<string, unknown> = {};
  if (parsed.data.substitute_email !== undefined)
    patch.substitute_email = parsed.data.substitute_email;
  if (parsed.data.substitute_name !== undefined)
    patch.substitute_name = parsed.data.substitute_name;
  if (parsed.data.title !== undefined)
    patch.title = parsed.data.title?.trim() || null;
  if (parsed.data.summary_md !== undefined)
    patch.summary_md = parsed.data.summary_md;
  if (parsed.data.leave_type !== undefined)
    patch.leave_type = parsed.data.leave_type;
  if (parsed.data.leave_start_date !== undefined)
    patch.leave_start_date = parsed.data.leave_start_date;
  if (parsed.data.leave_end_date !== undefined)
    patch.leave_end_date = parsed.data.leave_end_date;

  if (Object.keys(patch).length > 0) {
    const { data, error } = await supabase
      .from("backup_requests")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "수정 결과 없음" };
  }

  // services 교체 (제공된 경우만)
  if (parsed.data.services !== undefined) {
    const { error: delErr } = await supabase
      .from("backup_request_services")
      .delete()
      .eq("backup_request_id", id);
    if (delErr) {
      return { ok: false, error: `services 교체 실패: ${delErr.message}` };
    }
    if (parsed.data.services.length > 0) {
      const joinRows = parsed.data.services.map((s) => ({
        backup_request_id: id,
        service_id: s.service_id,
        substitute_email:
          s.substitute_email ?? parsed.data.substitute_email ?? null,
        substitute_name:
          s.substitute_name ?? parsed.data.substitute_name ?? null,
        contacts: s.contacts,
        note_md: s.note_md ?? null,
      }));
      const { error: insErr } = await supabase
        .from("backup_request_services")
        .insert(joinRows);
      if (insErr) {
        return { ok: false, error: `services 재삽입 실패: ${insErr.message}` };
      }
    }
  }

  // 최신 row 재조회 — 호출자에 갱신 row 제공
  const { data: refreshed, error: getErr } = await supabase
    .from("backup_requests")
    .select()
    .eq("id", id)
    .single();
  if (getErr || !refreshed) {
    return { ok: false, error: getErr?.message ?? "재조회 실패" };
  }

  revalidatePath(BACKUP_PATH);
  return { ok: true, row: refreshed as BackupRequestRow };
}

/**
 * PR-7: 백업 요청 삭제 — RLS로 본인 또는 admin만 가능.
 * backup_request_services / backup_request_mail_sends는 FK on delete cascade라 자동 정리됨.
 */
export async function deleteBackupRequest(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { error } = await supabase
    .from("backup_requests")
    .delete()
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(BACKUP_PATH);
  return { ok: true };
}
