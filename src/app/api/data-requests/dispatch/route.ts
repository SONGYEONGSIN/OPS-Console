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

  let sent = 0;
  let failed = 0;
  let updateFailed = 0;
  for (const row of rows) {
    const result = await sendGraphMail({
      senderUserId: row.sender_email,
      toEmail: row.to_email,
      toName: row.to_name ?? undefined,
      cc: row.cc ?? [],
      subject: row.subject,
      text: row.body,
    });
    const patch = result.ok
      ? { status: "sent", sent_at: new Date().toISOString() }
      : { status: "failed", error: result.error };
    if (result.ok) sent += 1;
    else failed += 1;
    const { error: updateError } = await supabase
      .from("data_request_sends")
      .update(patch)
      .eq("id", row.id);
    if (updateError) updateFailed += 1;
  }

  return NextResponse.json({ ok: true, dispatched: rows.length, sent, failed, updateFailed });
}
