import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type WeeklyRunStatus = "created" | "skipped" | "dry_run" | "failed";

export type WeeklyRunRecord = {
  status: WeeklyRunStatus;
  year?: number | null;
  month?: number | null;
  week?: number | null;
  fileName?: string | null;
  sender?: string | null;
  shareLink?: string | null;
  teamsSent?: boolean;
  message: string;
};

/**
 * 본부차주보고 실행 결과 1행을 weekly_report_runs에 적재 — best-effort.
 * 기록 실패(테이블 미적용/네트워크 등)가 잡 성패에 영향 주지 않도록 삼킨다.
 */
export async function recordWeeklyRun(rec: WeeklyRunRecord): Promise<void> {
  try {
    const admin = createAdminClient();
    await admin.from("weekly_report_runs").insert({
      status: rec.status,
      year: rec.year ?? null,
      month: rec.month ?? null,
      week: rec.week ?? null,
      file_name: rec.fileName ?? null,
      sender: rec.sender ?? null,
      share_link: rec.shareLink ?? null,
      teams_sent: rec.teamsSent ?? false,
      message: rec.message,
    });
  } catch {
    // best-effort — 기록 실패는 무시
  }
}
