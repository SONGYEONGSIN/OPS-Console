import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractSmsCode } from "@/features/sms-codes/extract-code";

/**
 * 이보다 길면 인증문자가 아니다(Moa 실문자는 40자 남짓). 400 으로 거절하지 않는
 * 이유: Tasker 는 4xx 를 재시도하고, 그때마다 그 긴 개인 문자가 서버로 다시 온다.
 */
const MAX_SMS_BODY_CHARS = 2000;

/** 숫자만 남긴다 — `02-1234-5678` 과 `0212345678` 은 같은 번호다. */
const digits = (s: string) => s.replace(/\D/g, "");

/**
 * 허용 발신번호(`SMS_INGEST_SENDERS`, 쉼표 구분). 비어 있으면 창구가 **닫힌다** —
 * '설정이 없으면 전부 통과'로 두면 설정 누락이 조용히 창구를 연다.
 */
function allowedSenders(): string[] {
  return (process.env.SMS_INGEST_SENDERS ?? "")
    .split(",")
    .map(digits)
    .filter(Boolean);
}

/**
 * 발신번호 대조. 폰은 아무나 문자를 보낼 수 있는 수신함이라, 본문만 보면 운영자
 * 폰 번호를 아는 사람이 Moa 문구를 흉내 내 **비밀키 없이** 가짜 코드를 넣을 수 있다
 * (보안 리뷰 H1). 번호는 비교에만 쓰고 저장·응답 어디에도 남기지 않는다.
 */
function senderAllowed(request: Request, allowed: string[]): boolean {
  const sender = digits(request.headers.get("x-sms-sender") ?? "");
  return sender.length > 0 && allowed.includes(sender);
}

/**
 * 폰(Tasker)이 문자 원문을 넣는 창구 — `Authorization: Bearer ${SMS_INGEST_SECRET}`
 * + `X-Sms-Sender: <발신번호>`.
 *
 * 키를 `CRON_SECRET` 과 **분리**한 이유: 폰은 분실·초기화되고 Tasker 설정은 평문이다.
 * 그때 이 창구 하나만 갈면 되고, 마감 인제스트·폴러·자동화 전부를 갈 필요가 없다.
 *
 * 본문은 `text/plain` 원문이다. Tasker 에서 JSON 을 조립하면 문자에 `"` 나 줄바꿈이
 * 있을 때 깨지고, 그 실패는 새벽에 400 으로 조용히 난다.
 *
 * **본문은 저장도, 로그도, 응답 에코도 하지 않는다.** 개인 문자가 섞여 올 수 있다.
 * 서버가 코드만 뽑아 넣고, 인증문자가 아니면 2xx 로 조용히 버린다 — Tasker 가
 * 재시도하지 않게. 400 은 본문이 **비었을 때**뿐이다(Tasker 설정 오류 = 고칠 것).
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

  const allowed = allowedSenders();
  if (allowed.length === 0) {
    return NextResponse.json(
      { ok: false, error: "SMS_INGEST_SENDERS 미설정" },
      { status: 500 },
    );
  }
  if (!senderAllowed(request, allowed)) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const body = await request.text();
  if (body.length === 0) {
    return NextResponse.json(
      { ok: false, error: "empty body" },
      { status: 400 },
    );
  }
  if (body.length > MAX_SMS_BODY_CHARS) {
    return NextResponse.json({ ok: true, stored: false });
  }

  const code = extractSmsCode(body);
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
