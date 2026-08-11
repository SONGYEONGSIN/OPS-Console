import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { aiTipCandidateBatchSchema } from "@/features/ai-tip-candidates/schemas";

/**
 * AI TIP 후보 적재/조회 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * GET  — 이미 수집한 repo_full_name 전체. status 무관(promoted·hidden 포함)이라
 *        한 번 거른 리포가 다음 회차에 다시 올라오지 않는다.
 * POST — 후보 적재. 다중 행 insert는 1건만 repo_full_name UNIQUE를 위반해도 문장 전체가
 *        롤백되므로 upsert(ignoreDuplicates)로 신규만 반영하고, select로 돌아온 실제
 *        반영 건수만 inserted로 센다 (closing/ingest 라우트와 동일 전략).
 */
function unauthorized(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  if (!secret)
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  const auth = request.headers.get("authorization") ?? "";
  if (auth !== `Bearer ${secret}`)
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  return null;
}

export async function GET(request: Request) {
  const bad = unauthorized(request);
  if (bad) return bad;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ai_tip_candidates")
    .select("repo_full_name");
  if (error)
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );

  return NextResponse.json({
    ok: true,
    seen: (data ?? []).map((r) => r.repo_full_name as string),
  });
}

export async function POST(request: Request) {
  const bad = unauthorized(request);
  if (bad) return bad;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "invalid json" },
      { status: 400 },
    );
  }

  const parsed = aiTipCandidateBatchSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" },
      { status: 400 },
    );

  const rows = parsed.data.candidates;
  let inserted = 0;
  if (rows.length > 0) {
    const supabase = createAdminClient();
    // repo_full_name 충돌은 무시하고 신규만 반영 — 다중 행 insert였다면 1건 중복이
    // 배치 전체를 롤백시켰을 것. select로 실제 반영된 건수만 회수한다.
    const { data, error } = await supabase
      .from("ai_tip_candidates")
      .upsert(rows, { onConflict: "repo_full_name", ignoreDuplicates: true })
      .select("repo_full_name");
    if (error) {
      await recordAutomationRun("ai-tips-collect", {
        ok: false,
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    inserted = data?.length ?? 0;
  }

  await recordAutomationRun("ai-tips-collect", {
    ok: true,
    message: `후보 ${inserted}건 수집`,
  });

  return NextResponse.json({
    ok: true,
    inserted,
    skipped: rows.length - inserted,
  });
}
