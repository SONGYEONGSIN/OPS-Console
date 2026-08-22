import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { buildOpenNoticeHtml } from "@/features/open-notices/mail-html";

type DueRow = {
  id: string;
  sender_email: string;
  to_email: string;
  to_name: string | null;
  cc: { email: string; name?: string }[] | null;
  subject: string;
  body: string;
};

/**
 * 오픈안내 예약 발송 cron 진입점.
 * - POST + x-cron-secret 헤더: GitHub Actions / 수동 trigger 호환
 * - GET + Authorization: Bearer ${CRON_SECRET}: Vercel Cron 호환
 *
 * 실 트리거는 cron-job.org 다(자료요청·백업요청과 동일). GitHub Actions 의
 * schedule 은 지연·누락이 잦아 꺼져 있고 수동 트리거만 남긴다.
 */

function isAuthorized(req: Request, secret: string): boolean {
  if (req.headers.get("x-cron-secret") === secret) return true;
  if (req.headers.get("authorization") === `Bearer ${secret}`) return true;
  return false;
}

async function handle(): Promise<Response> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_due_open_notices");
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  const rows = (data ?? []) as DueRow[];

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  let sent = 0;
  let failed = 0;
  let dispatchedDry = 0;
  let updateFailed = 0;
  // 주의: claim 후 update 전에 프로세스가 죽으면 행이 'sending'에 멈춘다
  // (다음 claim은 'scheduled'만 잡음). **자동 복구를 넣지 않는다** — 갇히는 경로가
  // 둘인데 구분이 안 된다: (a) 발송 전에 죽음 → 되돌리는 게 맞음, (b) 발송은
  // 성공했는데 update만 실패 → 되돌리면 대학에 두 번 간다. 실측상 아직 0건이다.
  //
  // 실제로 갇히면(updateFailed 카운트가 단서) 발송 여부를 Graph 보낸편지함으로
  // 확인한 뒤 사람이 되돌린다:
  //   update open_notice_sends set status='scheduled'
  //   where status='sending' and scheduled_at < now() - interval '1 hour';
  for (const row of rows) {
    let patch: Record<string, unknown>;
    if (dryRun) {
      dispatchedDry += 1;
      patch = { status: "dry_run", sent_at: new Date().toISOString() };
    } else {
      // 발신 명의(row.sender_email)의 운영자 정보로 HTML 서명 생성. row별 1회 조회.
      const { data: senderSig } = await supabase
        .from("operators")
        .select("name, department, team, role, phone")
        .eq("email", row.sender_email)
        .maybeSingle();
      const result = await sendGraphMail({
        senderUserId: row.sender_email,
        toEmail: row.to_email,
        toName: row.to_name ?? undefined,
        cc: row.cc ?? [],
        subject: row.subject,
        // 즉시 발송(server action)과 **같은 변환기**를 써야 한다. buildReplyHtml 을
        // 쓰면 예약분만 열 정렬이 무너져 같은 초안이 두 모양으로 나간다.
        html: buildOpenNoticeHtml(row.body, senderSig ?? {}),
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
      .from("open_notice_sends")
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

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !isAuthorized(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return handle();
}

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || !isAuthorized(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return handle();
}
