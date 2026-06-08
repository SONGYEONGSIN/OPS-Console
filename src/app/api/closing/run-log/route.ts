import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { closingRunLogSchema } from "@/features/closing/schemas";

/**
 * 서비스 마감 스크래퍼 실행 결과 보고 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 스크래퍼(GitHub Action)가 매 실행 종료 시 결과를 보고한다:
 * success(적재 완료 + service_count) / skipped(격주 off주) / failed(로그인·스크랩 실패 + message).
 * closing_scrape_runs에 1행 적재 → OPS 인스펙터 '실행 로그'에 실패까지 표시된다.
 *
 * ingest(데이터 적재)와 분리 — 실패/off주는 데이터가 없어도 실행 흔적을 남겨야 하므로.
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

  const parsed = closingRunLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { status, service_count, message } = parsed.data;
  const supabase = createAdminClient();
  const { error } = await supabase.from("closing_scrape_runs").insert({
    status,
    service_count,
    message: message ?? null,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
