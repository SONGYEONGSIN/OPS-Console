import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleTypeSchema } from "@/features/schedule/schemas";

/**
 * 어시스턴트 도구 — 일정 조회. `Authorization: Bearer ${CRON_SECRET}` 인증.
 *
 * 회사 PC 폴러가 Claude에게 붙여주는 MCP 도구가 이걸 호출한다. PC에 서비스 키를
 * 내려보내지 않으려고 API를 거친다 — PC가 아는 건 CRON_SECRET뿐이다.
 *
 * 볼트(문서)에 없는 게 여기 있다: 누가 언제 쉬고 무엇이 언제 열리는지는 절차가
 * 아니라 데이터라 파일이 아니라 시스템에 산다.
 */

const querySchema = z.object({
  // 날짜만 받는다. 시각까지 받으면 타임존 해석이 갈려 하루가 밀린다.
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from은 YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to는 YYYY-MM-DD"),
  // 오타를 조용히 0건으로 만들지 않는다 — 모델이 "없다"고 답해버린다.
  type: scheduleTypeSchema.optional(),
});

/** 한 번에 퍼가는 상한. 기간을 넓게 줘도 컨텍스트를 덮지 않게. */
const MAX_ROWS = 200;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET 환경 변수 미설정" },
      { status: 500 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const sp = new URL(request.url).searchParams;
  const parsed = querySchema.safeParse({
    from: sp.get("from") ?? undefined,
    to: sp.get("to") ?? undefined,
    type: sp.get("type") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: parsed.error.issues[0].message },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  let q = admin
    .from("schedule_events")
    .select("type, title, description, start_at, end_at, all_day, assignee_email")
    .gte("start_at", parsed.data.from)
    // to는 그 날을 포함해야 하므로 하루 끝까지 — 날짜만 비교하면 당일이 빠진다.
    .lte("start_at", `${parsed.data.to}T23:59:59`);
  if (parsed.data.type) q = q.eq("type", parsed.data.type);

  const { data, error } = await q.order("start_at").limit(MAX_ROWS);
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, events: data ?? [] });
}
