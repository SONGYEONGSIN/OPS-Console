import { NextRequest, NextResponse } from "next/server";
import { getJob } from "@/features/automations/registry";

/**
 * GitHub Actions cron 진입점 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * Body 또는 query `jobId` 검증 후 해당 automation job.run() 호출.
 *
 * UI에서 admin이 직접 호출하는 경로는 `runAutomationAction` (server action) 사용.
 * 본 route는 cron 전용 — secret 누설 시 임의 잡 실행 가능하므로 secret 보안 필수.
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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
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

  const result = await job.run();
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
