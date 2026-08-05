"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getCurrentOperator,
  type CurrentOperator,
} from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import {
  announcementServiceSchema,
  type AnnouncementServiceInput,
} from "./schemas";

const BACKUP_PATH = "/dashboard/backup";
const PERMISSION_ERROR = "권한 없음 — 발표 서비스 등록 권한이 없습니다.";

function isOperator(me: CurrentOperator | null): boolean {
  if (!me) return false;
  return me.permission === "admin" || me.permission === "member";
}

export type AnnouncementBulkResult = {
  ok: boolean;
  upserted: number;
  error?: string;
};

/**
 * 발표 서비스 일괄 등록 — 서비스ID 기준 upsert.
 *
 * 같은 자료를 다시 올려도 중복이 쌓이지 않고 이름·발표일만 갱신된다. 연락처 일괄등록은
 * 중복을 '건너뛰지만', 여기는 스냅샷 자료라 최신값으로 덮는 편이 맞다.
 * 쓰기는 service_role — 테이블 RLS는 읽기만 열려 있다.
 */
export async function upsertAnnouncementServicesBulk(
  rows: AnnouncementServiceInput[],
): Promise<AnnouncementBulkResult> {
  const me = await getCurrentOperator();
  if (!isOperator(me)) {
    return { ok: false, upserted: 0, error: PERMISSION_ERROR };
  }

  const valid = rows.filter(
    (r) => announcementServiceSchema.safeParse(r).success,
  );
  if (valid.length === 0) return { ok: true, upserted: 0 };

  const admin = createAdminClient();
  const { error } = await admin
    .from("announcement_services")
    .upsert(valid, { onConflict: "service_id" });
  if (error) return { ok: false, upserted: 0, error: error.message };

  await logActivity({
    domain: "backup",
    action: "update",
    target_type: "announcement_services",
    target_name: `발표 서비스 ${valid.length}건`,
    level: "INFO",
    msg: "발표 서비스 일괄 등록",
  });
  revalidatePath(BACKUP_PATH);
  return { ok: true, upserted: valid.length };
}
