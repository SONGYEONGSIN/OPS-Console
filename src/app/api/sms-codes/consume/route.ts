import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { smsConsumeSchema } from "@/features/sms-codes/schemas";

/** 로그인 점유 TTL — 폴링 상한 90초 + 여유. 폴러가 pop 전에 죽어도 3분이면 풀린다. */
const INBOX_TTL_SEC = 180;

type ClaimRow = {
  acquired: boolean;
  holder: string | null;
  holder_since: string | null;
  cleared: number;
};
type PopRow = { code: string; received_at: string };

/**
 * 스크래퍼(회사 PC)가 우편함을 다루는 창구 — `Authorization: Bearer ${CRON_SECRET}`.
 *
 * - `reset`: 비우기 + 로그인 점유. 한 호출인 이유는 순서가 아니라 **원자성**이다 —
 *   점유를 못 잡았는데 남의 코드를 지우면 상대가 굶는다. 남이 점유 중이면 **409**.
 *   호출자는 이때 make 로 우회하지 않고 멈춘다(SMS 두 통이 섞이면 캡차 잠금).
 * - `pop`: 최신 1건을 꺼내며 지운다. 아직 없으면 `code: null` — 호출자가 기다린다.
 *
 * 만료·점유 규칙은 DB 함수 하나에 있다(`claim_sms_inbox` / `pop_sms_code`).
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 },
    );
  }
  const parsed = smsConsumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { action, consumer } = parsed.data;
  const admin = createAdminClient();

  if (action === "reset") {
    const { data, error } = await admin.rpc("claim_sms_inbox", {
      p_consumer: consumer,
      p_ttl_sec: INBOX_TTL_SEC,
    });
    const row = (data as ClaimRow[] | null)?.[0];
    if (error || !row) {
      return NextResponse.json(
        { ok: false, error: error?.message ?? "claim_sms_inbox 응답 없음" },
        { status: 500 },
      );
    }
    if (!row.acquired) {
      return NextResponse.json(
        {
          ok: false,
          error: "lease-held",
          holder: row.holder,
          holderSince: row.holder_since,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ ok: true, cleared: row.cleared });
  }

  const { data, error } = await admin.rpc("pop_sms_code", {
    p_consumer: consumer,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  const row = (data as PopRow[] | null)?.[0];
  if (!row) return NextResponse.json({ ok: true, code: null });
  return NextResponse.json({
    ok: true,
    code: row.code,
    receivedAt: row.received_at,
  });
}
