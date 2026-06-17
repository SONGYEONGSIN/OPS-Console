import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * 서비스 마감 '로컬 수동 실행' 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 회사 PC 폴러(poll-local.ps1)가 호출한다.
 *   GET  → 가장 오래된 pending 1건을 원자적 claim(→running). 없으면 { request: null }.
 *   POST → 완료 보고 { id, ok, message } → done/failed.
 * 쓰기는 service_role(admin client)로만. CRON_SECRET 누설 시 임의 트리거 가능하나 ingest와 동일 수준.
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
    .from("closing_scrape_requests")
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, request: null });
  }

  // 원자적 claim — 아직 pending일 때만 running으로 전환(동시 폴러 경합 방지)
  const { data: claimed, error } = await admin
    .from("closing_scrape_requests")
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", pending[0].id)
    .eq("status", "pending")
    .select("id, requested_at, requested_by")
    .maybeSingle();
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  // 경합으로 다른 폴러가 가져갔으면 null
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
  const status = body.ok === true ? "done" : "failed";
  const message =
    typeof body.message === "string" ? body.message.slice(0, 500) : null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("closing_scrape_requests")
    .update({ status, finished_at: new Date().toISOString(), message })
    .eq("id", id);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
