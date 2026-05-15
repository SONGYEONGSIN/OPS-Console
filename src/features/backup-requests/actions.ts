"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { backupRequestCreateSchema, type BackupRequestRow } from "./schemas";

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

  const supabase = await createClient();
  // PR-2: services 컬럼 drop됨. join은 backup_request_services 테이블로 별도 insert.
  // PR-4: top-level contacts 제거 (서비스로 이전).
  const payload = {
    requester_email: me.email,
    requester_team: me.team ?? null,
    substitute_email: parsed.data.substitute_email,
    substitute_name: parsed.data.substitute_name,
    summary_md: parsed.data.summary_md,
    leave_start_date: parsed.data.leave_start_date ?? null,
    leave_end_date: parsed.data.leave_end_date ?? null,
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
