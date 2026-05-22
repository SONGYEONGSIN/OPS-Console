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
  for (const row of rows) {
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
      await supabase
        .from("data_request_sends")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      failed += 1;
      await supabase
        .from("data_request_sends")
        .update({ status: "failed", error: result.error })
        .eq("id", row.id);
    }
  }

  return NextResponse.json({ ok: true, dispatched: rows.length, sent, failed });
}
