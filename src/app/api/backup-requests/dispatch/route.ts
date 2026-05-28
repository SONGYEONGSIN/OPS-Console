import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendBackupRequestMail } from "@/features/backup-requests/mail-actions";

type DueRow = {
  id: string;
  requester_email: string;
};

/**
 * PR-6: pg_cron이 주기적으로 호출. CRON_SECRET 헤더 인증.
 * claim_due_backup_requests RPC로 status='scheduled' → 'sending' atomic update.
 * 잠긴 row마다 sendBackupRequestMail({cronSender})로 발송. mail-actions가 status를 sent/mail_failed로 마무리.
 *
 * 주의: claim 후 update 전에 프로세스가 죽으면 row가 'sending'에 멈춤. 다음 claim은 'scheduled'만 잡음.
 * v1은 수동 복구 (SET mail_status='scheduled' WHERE mail_status='sending' AND ...).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_backup_requests");
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  const rows = (data ?? []) as DueRow[];

  let sent = 0;
  let failed = 0;
  for (const row of rows) {
    // operator displayName lookup — 메일 본문 'requester' 라벨용
    // operators 테이블 컬럼은 'name' (display_name 아님).
    const { data: opRow } = await supabase
      .from("operators")
      .select("name")
      .eq("email", row.requester_email)
      .maybeSingle();
    const displayName =
      (opRow as { name: string | null } | null)?.name ??
      row.requester_email.split("@")[0] ??
      row.requester_email;

    const result = await sendBackupRequestMail(
      { backup_request_id: row.id },
      {
        cronSender: { email: row.requester_email, displayName },
      },
    );
    if (result.ok) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({
    ok: true,
    dispatched: rows.length,
    sent,
    failed,
  });
}
