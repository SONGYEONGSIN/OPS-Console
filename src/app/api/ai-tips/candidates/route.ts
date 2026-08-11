import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { aiTipCandidateBatchSchema } from "@/features/ai-tip-candidates/schemas";

/**
 * AI TIP 후보 적재/조회 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * GET  — 이미 수집한 repo_full_name 전체. status 무관(promoted·hidden 포함)이라
 *        한 번 거른 리포가 다음 회차에 다시 올라오지 않는다.
 * POST — 후보 적재. repo_full_name unique 충돌은 무시하고 건수만 센다.
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
    // unique(repo_full_name) 충돌은 무시 — 같은 리포가 다시 와도 기존 후보를 덮지 않는다.
    const { error } = await supabase
      .from("ai_tip_candidates")
      .insert(rows, { count: "exact" });
    if (error && !/duplicate key/i.test(error.message)) {
      await recordAutomationRun("ai-tips-collect", {
        ok: false,
        message: error.message,
      });
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 500 },
      );
    }
    inserted = error ? 0 : rows.length;
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
