import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { recordAutomationRun } from "@/features/automations/run-recorder";
import { __resetSmsSenderCache } from "@/features/sms-sender/queries";
import {
  advancedWatermarks,
  completeBodySchema,
  finalStatus,
  mergeWatermarks,
  runMessage,
} from "@/features/sms-sender/status-refresh/contract";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SMS 현황 최신화 폴러 endpoint — `Authorization: Bearer ${CRON_SECRET}` 인증.
 * 회사 PC 폴러(scripts/sms-status-refresh/poll-local.ps1)가 호출한다.
 *   GET  → 가장 오래된 pending 1건을 조건부 claim(→running) + 단계별 기준 시각(watermarks).
 *   POST → 완료 보고(CompleteBody) → done/failed 저장 + 자동화 실행 기록 + 화면 캐시 무효화.
 *
 * 모르는 단계·코드도 저장한다 — 새 폴러가 먼저 배포돼도 결과가 사라지지 않게(contract.ts).
 * 쓰기는 service_role(admin client)로만.
 */

const TABLE = "sms_status_refresh_requests";
const JOB_ID = "sms-status-refresh";
/** watermark 를 합칠 때 보는 최근 완료 행 수. */
const WATERMARK_LOOKBACK = 50;

type Guard = { ok: true } | { ok: false; response: NextResponse };

function guard(request: NextRequest): Guard {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
        { status: 500 },
      ),
    };
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      ),
    };
  }
  return { ok: true };
}

function serverError(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  const g = guard(request);
  if (!g.ok) return g.response;

  const admin = createAdminClient();
  const { data: pending, error: pendingErr } = await admin
    .from(TABLE)
    .select("id")
    .eq("status", "pending")
    .order("requested_at", { ascending: true })
    .limit(1);
  if (pendingErr) return serverError(pendingErr.message);
  const first = (pending ?? [])[0] as { id: string } | undefined;
  if (!first) return NextResponse.json({ ok: true, request: null });

  // claim 전에 읽는다 — claim 뒤에 실패하면 running 이 40분 동안 큐를 막는다.
  const { data: finished, error: wmErr } = await admin
    .from(TABLE)
    .select("watermarks")
    .not("finished_at", "is", null)
    .order("finished_at", { ascending: false })
    .limit(WATERMARK_LOOKBACK);
  if (wmErr) return serverError(wmErr.message);
  const watermarks = mergeWatermarks(
    ((finished ?? []) as { watermarks: Record<string, string> | null }[]).map(
      (r) => r.watermarks ?? {},
    ),
  );

  // 조건부 claim — 아직 pending 일 때만 running 으로(동시 폴러 경합 방지)
  const { data: claimed, error } = await admin
    .from(TABLE)
    .update({ status: "running", claimed_at: new Date().toISOString() })
    .eq("id", first.id)
    .eq("status", "pending")
    .select("id, requested_at, requested_by")
    .maybeSingle();
  if (error) return serverError(error.message);
  if (!claimed) return NextResponse.json({ ok: true, request: null });

  return NextResponse.json({ ok: true, request: { ...claimed, watermarks } });
}

export async function POST(request: NextRequest) {
  const g = guard(request);
  if (!g.ok) return g.response;

  const raw: unknown = await request.json().catch(() => null);
  const parsed = completeBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "본문 형식 오류" },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const status = finalStatus(body);
  const summary = runMessage(body);

  const admin = createAdminClient();
  const { error } = await admin
    .from(TABLE)
    .update({
      status,
      finished_at: new Date().toISOString(),
      message: body.message?.slice(0, 500) ?? summary,
      result: body.result ?? null,
      watermarks: body.result ? advancedWatermarks(body.result) : {},
    })
    .eq("id", body.id);
  if (error) return serverError(error.message);

  // 회사 PC 잡은 이 보고가 서버로 오는 유일한 창구다 — 여기서 남겨야 일일 보고에 잡힌다.
  // 메시지는 단계·성패·코드만(번호가 섞일 수 있는 summary·tail 은 싣지 않는다).
  await recordAutomationRun(JOB_ID, {
    ok: status === "done",
    message: summary,
  });

  // 이 인스턴스의 화면 캐시만 비운다 — 다른 인스턴스는 모듈 TTL 안에 따라온다.
  __resetSmsSenderCache();
  revalidatePath("/dashboard/internal-admin");

  return NextResponse.json({ ok: true, status });
}
