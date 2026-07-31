import { NextResponse, type NextRequest } from "next/server";
import { stageBriefingDraft } from "@/features/automations/jobs/team-briefing";
import type { BriefingPayload } from "@/features/automations/jobs/team-briefing-build";
import { getJobEnabled } from "@/features/automations/queries";
import { recordAutomationRun } from "@/features/automations/run-recorder";

const JOB_ID = "team-briefing";

/**
 * 주간 브리핑 초안 저장 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * body { payload } (claude -p 스토리 포함 가능) → team_briefings에 status='draft'로 insert.
 * 그룹채팅 티저는 여기서 보내지 않는다 — 사람이 미리보기로 확인한 뒤 자동화 페이지에서 발행한다.
 *
 * enabled gate: draft 라우트와 별개로 여기서도 토글을 확인한다(직접 호출 차단).
 * 초안 생성 결과는 automation_runs에 기록해 '마지막 실행'에 반영한다.
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
      message: "자동 실행 OFF — 초안 skip",
    });
  }

  const startedMs = Date.now();
  const r = await stageBriefingDraft(payload);
  await recordAutomationRun(JOB_ID, {
    ok: r.ok,
    skipped: false,
    message: r.ok
      ? `초안 #${r.nextIssueNo}호 생성 — 발행 대기${r.notified ? "" : " · 본인 Teams 알림 미설정"}`
      : r.message,
    durationMs: Date.now() - startedMs,
  });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: r.message }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    url: r.url,
    nextIssueNo: r.nextIssueNo,
  });
}
