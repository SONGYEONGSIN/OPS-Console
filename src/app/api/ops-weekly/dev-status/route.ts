import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { devStatusIngestSchema } from "@/features/ops-weekly/dev-status-schemas";
import { stageFromTestOpen } from "@/features/ops-weekly/dev-status";

/**
 * 주간보고 개발 구분 인제스트 — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 회사 PC 수집기가 Moa 에서 읽은 서비스별 '테스트 오픈' 칸을 보낸다.
 * - 지우지 않는 upsert: 이번에 안 온 서비스의 이전 행은 그대로 둔다(미확인 판정은 리더가 collected_at 으로 한다).
 * - collected_at 은 서버 시각이다 — PC 시계를 믿지 않는다.
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

  const parsed = devStatusIngestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );
  }

  const collectedAt = new Date().toISOString();
  const rows = parsed.data.rows.map((r) => ({
    service_id: r.service_id,
    stage: stageFromTestOpen(r.test_open),
    raw_label: r.test_open,
    collected_at: collectedAt,
  }));

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("ops_weekly_dev_status")
    .upsert(rows, { onConflict: "service_id" });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  const dev = rows.filter((r) => r.stage === "dev").length;
  return NextResponse.json({
    ok: true,
    received: rows.length,
    dev,
    test: rows.length - dev,
  });
}
