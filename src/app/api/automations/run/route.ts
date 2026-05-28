import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/features/automations/registry";
import { getJobEnabled } from "@/features/automations/queries";

/**
 * GitHub Actions cron 진입점 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * Body 또는 query `jobId` 검증 후 해당 automation job.run() 호출.
 *
 * UI에서 admin이 직접 호출하는 경로는 `runAutomationAction` (server action) 사용.
 * 본 route는 cron 전용 — secret 누설 시 임의 잡 실행 가능하므로 secret 보안 필수.
 *
 * enabled gate: DB automation_settings.enabled=false 이면 cron silent skip.
 * (UI 토글이 자동 실행 권한 게이트 역할. enabled=true 시 cron 자동, 수동 UI 차단.)
 */
export async function POST(request: NextRequest) {
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

  const jobId =
    request.nextUrl.searchParams.get("jobId") ??
    (await request.json().catch(() => ({}))).jobId;

  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json(
      { ok: false, error: "jobId 누락" },
      { status: 400 },
    );
  }

  const job = getJob(jobId);
  if (!job) {
    return NextResponse.json(
      { ok: false, error: `알 수 없는 자동화: ${jobId}` },
      { status: 404 },
    );
  }

  // UI 토글 OFF면 cron silent skip — 사용자가 자동 실행을 의도적으로 끈 상태.
  const enabled = await getJobEnabled(jobId);
  if (!enabled) {
    return NextResponse.json(
      { ok: true, skipped: true, message: "자동 실행 OFF — cron skip" },
      { status: 200 },
    );
  }

  const result = await job.run();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
