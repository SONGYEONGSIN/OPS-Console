import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBriefingData } from "@/features/automations/jobs/team-briefing";

/**
 * 주간 브리핑 초안 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 상시 맥 launchd(scripts/team-briefing/publish-local.mjs)가 호출:
 *   GET → 서버가 주간 데이터 집계(payload) + 다음 호수 반환.
 * 로컬이 claude -p로 스토리를 붙여 POST /api/team-briefing/publish 로 발행한다.
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

  const built = await buildBriefingData();
  if (!built.ok) {
    return NextResponse.json(
      { ok: false, error: built.message },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  const { count } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true });

  return NextResponse.json({
    ok: true,
    payload: built.payload,
    nextIssueNo: (count ?? 0) + 1,
  });
}
