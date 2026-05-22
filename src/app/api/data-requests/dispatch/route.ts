import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";

type DueRow = {
  id: string;
  sender_email: string;
  to_email: string;
  to_name: string | null;
  cc: { email: string; name?: string }[] | null;
  subject: string;
  body: string;
};

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("x-cron-secret") !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_data_requests");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as DueRow[];

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  let sent = 0;
  let failed = 0;
  let dispatchedDry = 0;
  let updateFailed = 0;
  // 주의: claim 후 update 전에 프로세스가 죽으면 행이 'sending'에 멈춘다(다음 claim은 'scheduled'만 잡음).
  // v1은 수동 복구(SET status='scheduled' WHERE status='sending'). updateFailed로 관찰 가능.
  for (const row of rows) {
    let patch: Record<string, unknown>;
    if (dryRun) {
      dispatchedDry += 1;
      patch = { status: "dry_run", sent_at: new Date().toISOString() };
    } else {
      const result = await sendGraphMail({
        senderUserId: row.sender_email,
        toEmail: row.to_email,
        toName: row.to_name ?? undefined,
        cc: row.cc ?? [],
        subject: row.subject,
        text: row.body,
      });
      if (result.ok) {
        sent += 1;
        patch = { status: "sent", sent_at: new Date().toISOString() };
      } else {
        failed += 1;
        patch = { status: "failed", error: result.error };
      }
    }
    const { error: updateError } = await supabase
      .from("data_request_sends")
      .update(patch)
      .eq("id", row.id);
    if (updateError) updateFailed += 1;
  }

  return NextResponse.json({
    ok: true,
    dispatched: rows.length,
    sent,
    failed,
    dryRun: dispatchedDry,
    updateFailed,
  });
}
