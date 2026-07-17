import { NextResponse, type NextRequest } from "next/server";
import { publishBriefing } from "@/features/automations/jobs/team-briefing";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";

/**
 * 주간 브리핑 발행 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * body { payload } (claude -p 스토리 포함 가능) → team_briefings insert + Teams 티저 발송.
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

  const r = await publishBriefing(payload);
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
