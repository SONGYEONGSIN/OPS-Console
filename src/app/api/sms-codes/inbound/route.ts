import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractSmsCode } from "@/features/sms-codes/extract-code";
import { smsInboundBodySchema } from "@/features/sms-codes/schemas";

/**
 * 폰(Tasker)이 문자 원문을 넣는 창구 — `Authorization: Bearer ${SMS_INGEST_SECRET}`.
 *
 * 키를 `CRON_SECRET` 과 **분리**한 이유: 폰은 분실·초기화되고 Tasker 설정은 평문이다.
 * 그때 이 창구 하나만 갈면 되고, 마감 인제스트·폴러·자동화 전부를 갈 필요가 없다.
 *
 * 본문은 `text/plain` 원문이다. Tasker 에서 JSON 을 조립하면 문자에 `"` 나 줄바꿈이
 * 있을 때 깨지고, 그 실패는 새벽에 400 으로 조용히 난다.
 *
 * **본문은 저장도, 로그도, 응답 에코도 하지 않는다.** 개인 문자가 섞여 올 수 있다.
 * 서버가 6자리만 뽑아 넣고, 인증문자가 아니면 2xx 로 조용히 버린다 — Tasker 가
 * 재시도하지 않게.
 */
export async function POST(request: Request) {
  const secret = process.env.SMS_INGEST_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "SMS_INGEST_SECRET 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = smsInboundBodySchema.safeParse(await request.text());
  if (!body.success) {
    return NextResponse.json(
      { ok: false, error: "empty body" },
      { status: 400 },
    );
  }

  const code = extractSmsCode(body.data);
  if (!code) return NextResponse.json({ ok: true, stored: false });

  const { error } = await createAdminClient()
    .from("sms_codes")
    .insert({ code });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, stored: true });
}
