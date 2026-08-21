import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { POLLERS } from "@/features/system-status/pollers";

/**
 * 폴러가 "살아있음"을 남기는 창구 — `Authorization: Bearer ${CRON_SECRET}`.
 *
 * 큐 기록만으로는 **요청이 없을 때** 조용한 폴러와 죽은 폴러를 구분할 수 없다.
 * 2026-08-20 밤 어시스턴트 폴러가 죽었는데 20:49 질문이 12시간 뒤에야 답을 받았고,
 * 그 사이 화면은 'unknown'만 보여줬다.
 *
 * 폴러는 1분마다 보낸다. 실패해도 폴러는 신경 쓰지 않는다 — 심박 때문에 일이
 * 멈추면 주객이 뒤바뀐다.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    pollerId?: unknown;
    machine?: unknown;
  };
  const pollerId = typeof body.pollerId === "string" ? body.pollerId : "";
  // 등록된 폴러만 받는다 — 오타가 조용히 새 행을 만들면 화면에 유령이 생긴다.
  if (!POLLERS.some((p) => p.id === pollerId)) {
    return NextResponse.json(
      { ok: false, error: `알 수 없는 폴러: ${pollerId}` },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error } = await admin.from("poller_heartbeats").upsert({
    poller_id: pollerId,
    beat_at: new Date().toISOString(),
    machine:
      typeof body.machine === "string" ? body.machine.slice(0, 100) : null,
  });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
