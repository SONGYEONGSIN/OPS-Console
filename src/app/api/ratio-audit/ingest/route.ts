import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";
import { ratioAuditIngestSchema } from "@/features/ratio-audit/schemas";
import {
  summarizeRatioAudit,
  buildRatioAuditHtml,
} from "@/features/ratio-audit/summary";

/**
 * 경쟁률 세팅 점검 결과 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 적재 → Teams 발송 순서를 지킨다. 발송이 실패해도 이력은 남기고 notified=false 로
 * 기록한다(주간 브리핑 초안 알림과 동일 원칙 — 알림 실패로 결과를 버리지 않는다).
 * 발송 실패 사유는 삼키지 않고 `notifyError`로 응답에 담아 관측 가능하게 남긴다.
 * 발신자는 팀 브리핑과 같은 계정을 쓰고, 방은 TEAMS_RATIO_AUDIT_CHAT_ID 로 분리한다.
 */
// 팀 브리핑과 동일 발신 계정 (team-briefing.ts BRIEFING_SENDER_DEFAULT).
const SENDER_DEFAULT = "ys1114@jinhakapply.com";

function sender(): string {
  return (
    process.env.TEAMS_RATIO_AUDIT_SENDER ||
    process.env.TEAMS_BRIEFING_SENDER ||
    SENDER_DEFAULT
  );
}

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
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const parsed = ratioAuditIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const s = summarizeRatioAudit(input);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ratio_audit_runs")
    .insert({
      scanned_count: s.scannedCount,
      finding_count: s.findingCount,
      link_error_count: s.linkErrorCount,
      status: s.status,
      payload: input,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { ok: false, error: error?.message ?? "적재 실패" },
      { status: 500 },
    );
  }

  const chatId = process.env.TEAMS_RATIO_AUDIT_CHAT_ID || "";
  let notified = false;
  let notifyError: string | undefined;
  if (chatId) {
    try {
      await sendTeamsChatMessage({
        operatorEmail: sender(),
        chatId,
        html: buildRatioAuditHtml(input),
      });
      await admin.from("ratio_audit_runs").update({ notified: true }).eq("id", data.id);
      notified = true;
    } catch (e) {
      // 발송 실패로 적재를 무르지 않는다. notified=false 로 남기되, 에러를 삼키지
      // 않고 notifyError로 응답에 담아 재발송 판단·관측에 쓴다.
      notified = false;
      notifyError = e instanceof Error ? e.message : String(e);
    }
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    findingCount: s.findingCount,
    notified,
    ...(notifyError ? { notifyError } : {}),
  });
}
