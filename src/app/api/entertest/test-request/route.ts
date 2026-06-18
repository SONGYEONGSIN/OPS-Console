import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * entertest 테스트 '로컬 실행' 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 회사 PC 폴러(poll-local.ps1)가 호출한다.
 *   GET  → 가장 오래된 pending 1건을 원자적 claim(→running). 없으면 { request: null }.
 *   POST → 완료 보고 { id, ok, message } → ok=false면 status=error.
 * (ok=true여도 결과 적재는 /ingest가 done/failed로 별도 확정. 여기 POST는 실패-종료 보고용.)
 */

function authorized(request: NextRequest, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data: pending } = await admin
    .from("entertest_test_runs")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  const { data: claimed, error } = await admin
    .from("entertest_test_runs")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, target_url, test_account, requested_by")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, request: claimed ?? null });
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (!authorized(request, secret)) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    id?: unknown;
    ok?: unknown;
    message?: unknown;
  };
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) {
    return NextResponse.json({ ok: false, error: "id 누락" }, { status: 400 });
  }

  // ok=false (러너 비정상 종료/예외) → error로 마감. ok=true는 ingest가 별도로 done/failed 적재했으므로 무시.
  const admin = createAdminClient();
  if (body.ok !== true) {
    const message =
      typeof body.message === "string" ? body.message.slice(0, 500) : null;
    const { error } = await admin
      .from("entertest_test_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", id);
    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
  }
  return NextResponse.json({ ok: true });
}
