import { NextResponse } from "next/server";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { OPS_WEEKLY_DEV_STATUS_JOB_ID } from "@/features/ops-weekly/constants";
import { devStatusRunLogSchema } from "@/features/ops-weekly/dev-status-schemas";

/**
 * 주간보고 개발 구분 수집기의 실행 결과 기록 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 회사 PC 작업은 서버가 결과를 알 길이 이 보고뿐이라, 여기서 recordAutomationRun 을 불러야
 * 실패 즉시 알림과 일일 보고에 잡힌다.
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

  const parsed = devStatusRunLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const { status, message } = parsed.data;
  await recordAutomationRun(OPS_WEEKLY_DEV_STATUS_JOB_ID, {
    ok: status === "success",
    message,
  });
  return NextResponse.json({ ok: true });
}
