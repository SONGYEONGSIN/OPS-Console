import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildBriefingData } from "@/features/automations/jobs/team-briefing";
import { getJobEnabled } from "@/features/automations/queries";
import { recordAutomationRun } from "@/features/automations/run-recorder";

const JOB_ID = "team-briefing";

/**
 * 주간 브리핑 초안 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 로컬 스케줄러(scripts/team-briefing/publish-local.mjs)가 호출:
 *   GET → 서버가 주간 데이터 집계(payload) + 다음 호수 반환.
 * 로컬이 claude -p로 스토리를 붙여 POST /api/team-briefing/publish 로 발행한다.
 *
 * enabled gate: 자동화 페이지 토글 OFF면 집계 전에 skip. /api/automations/run과
 * 동일한 게이트 — 로컬 경로에 게이트가 없어 OFF 상태로 발행되던 문제를 막는다.
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

  // 토글 OFF면 집계·스토리 생성 없이 조기 종료. 호출 사실은 이력에 남겨 추적 가능하게 한다.
  if (!(await getJobEnabled(JOB_ID))) {
    const message = "자동 실행 OFF — 로컬 발행 skip";
    await recordAutomationRun(JOB_ID, { ok: true, skipped: true, message });
    return NextResponse.json({ ok: true, skipped: true, message });
  }

  const built = await buildBriefingData();
  if (!built.ok) {
    return NextResponse.json(
      { ok: false, error: built.message },
      { status: 500 },
    );
  }

  // 호수는 발행분만 세어 매긴다 — 대기 중인 초안이 호수를 밀면
  // claude 스토리('제N호로 인사드려요')와 실제 발행 호수가 어긋난다.
  const admin = createAdminClient();
  const { count } = await admin
    .from("team_briefings")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  return NextResponse.json({
    ok: true,
    payload: built.payload,
    nextIssueNo: (count ?? 0) + 1,
  });
}
