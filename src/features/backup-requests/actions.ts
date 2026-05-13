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
  const payload = {
    requester_email: me.email,
    requester_team: me.team ?? null,
    substitute_email: parsed.data.substitute_email,
    substitute_name: parsed.data.substitute_name,
    services: parsed.data.services,
    contacts: parsed.data.contacts,
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
  revalidatePath(BACKUP_PATH);
  return { ok: true, row: data as BackupRequestRow };
}
