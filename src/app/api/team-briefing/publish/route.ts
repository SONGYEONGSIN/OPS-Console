import { NextResponse, type NextRequest } from "next/server";
import { publishBriefing } from "@/features/automations/jobs/team-briefing";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";
import { getJobEnabled } from "@/features/automations/queries";
import { recordAutomationRun } from "@/features/automations/run-recorder";

const JOB_ID = "team-briefing";

/**
 * 주간 브리핑 발행 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * body { payload } (claude -p 스토리 포함 가능) → team_briefings insert + Teams 티저 발송.
 *
 * enabled gate: 실제 부수효과(발행 + Teams 발송)가 일어나는 지점이므로 draft와 별개로
 * 여기서도 토글을 확인한다. 발행 결과는 automation_runs에 기록해 '마지막 실행'에 반영한다.
 */
function authorized(request: NextRequest, secret: string): boolean {
  return request.headers.get("authorization") === `Bearer ${secret}`;
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
    payload?: unknown;
  };
  const payload = body.payload as BriefingPayload | undefined;
  if (
    !payload ||
    typeof payload.dateLabel !== "string" ||
    typeof payload.contracts !== "object"
  ) {
    return NextResponse.json(
      { ok: false, error: "payload 누락/형식 오류" },
      { status: 400 },
    );
  }

  if (!(await getJobEnabled(JOB_ID))) {
    return NextResponse.json({
      ok: true,
      skipped: true,
      message: "자동 실행 OFF — 발행 skip",
    });
  }

  const startedMs = Date.now();
  const r = await publishBriefing(payload);
  await recordAutomationRun(JOB_ID, {
    ok: r.ok,
    skipped: false,
    message: r.ok
      ? `주간 브리핑 #${r.issueNo} 발행 (Teams ${r.sent ? "발송" : "생략"})`
      : r.message,
    durationMs: Date.now() - startedMs,
  });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    issueNo: r.issueNo,
    url: r.url,
    sent: r.sent,
  });
}
