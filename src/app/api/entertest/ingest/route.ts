import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { entertestIngestSchema } from "@/features/entertest/schemas";
import { summarizeChecks } from "@/features/entertest/result";

/**
 * entertest 테스트 러너 결과 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 러너가 케이스별 체크 결과를 보낸다. 서버가 summary를 계산해 result jsonb로 적재하고
 * status를 done/failed로 마감한다. 스크린샷은 러너가 Storage에 업로드 후 URL만 담아 보낸다.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`) {
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

  const parsed = entertestIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { id, status, checks, error_message } = parsed.data;
  const summary = summarizeChecks(checks);

  const admin = createAdminClient();
  const { error } = await admin
    .from("entertest_test_runs")
    .update({
      status,
      finished_at: new Date().toISOString(),
      result: { checks, summary },
      error_message: error_message ?? null,
    })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true, summary });
}
