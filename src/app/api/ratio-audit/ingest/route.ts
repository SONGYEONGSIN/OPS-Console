import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ratioAuditIngestSchema } from "@/features/ratio-audit/schemas";
import { summarizeRatioAudit } from "@/features/ratio-audit/summary";
import {
  dispatchRatioAudit,
  type RatioDispatchResult,
} from "@/features/ratio-audit/dispatch";

/**
 * 경쟁률 세팅 점검 결과 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 적재 → Teams 발송 순서를 지킨다. 발송이 실패해도 이력은 남기고 notified=false 로
 * 기록한다(주간 브리핑 초안 알림과 동일 원칙 — 알림 실패로 결과를 버리지 않는다).
 * 발송 실패 사유는 삼키지 않고 `notifyError`로 응답에 담아 관측 가능하게 남긴다.
 * 발송 대상(담당자 개인 채팅 / 관리자 취합)은 dispatch.ts 가 정한다.
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

  let dispatch: RatioDispatchResult;
  try {
    dispatch = await dispatchRatioAudit(input);
  } catch (e) {
    // 발송 실패로 적재를 무르지 않는다. notified=false 로 남기되, 에러를 삼키지
    // 않고 notifyError로 응답에 담아 재발송 판단·관측에 쓴다.
    return NextResponse.json({
      ok: true,
      id: data.id,
      findingCount: s.findingCount,
      notified: false,
      notifyError: e instanceof Error ? e.message : String(e),
    });
  }

  const notified = dispatch.sent > 0 || dispatch.adminNotified;
  if (notified) {
    await admin
      .from("ratio_audit_runs")
      .update({ notified: true })
      .eq("id", data.id);
  }

  return NextResponse.json({
    ok: true,
    id: data.id,
    findingCount: s.findingCount,
    notified,
    sent: dispatch.sent,
    unassignedCount: dispatch.unassignedCount,
    ...(dispatch.failed.length ? { failed: dispatch.failed } : {}),
    ...(dispatch.adminError ? { notifyError: dispatch.adminError } : {}),
  });
}
