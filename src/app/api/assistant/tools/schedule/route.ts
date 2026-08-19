import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleTypeSchema } from "@/features/schedule/schemas";
import { backupLeavesInRange } from "@/features/assistant/backup-leave";
import { toKstEvent } from "@/features/assistant/schedule-format";

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
  // 휴가는 두 곳에 나뉘어 있다. 연차 백업요청 11건 중 6건이 schedule_events 에
  // 없었다(2026-08-20 실측) — 사람이 일정 등록은 빠뜨려도 백업요청은 반드시
  // 보내기 때문이다(대리자 인수인계). 일정만 주면 "이번주 휴가자"에서 절반을 놓친다.
  //
  // 회의·당직처럼 다른 종류를 물었을 때는 붙이지 않는다 — 물어본 것과 무관한
  // 부재가 섞이면 답이 흐려진다.
  const wantsLeave = !parsed.data.type || parsed.data.type === "leave";
  const backupAbsences = wantsLeave
    ? backupLeavesInRange(
        ((
          await admin
            .from("backup_requests")
            .select("title, created_at")
            .order("created_at", { ascending: false })
            .limit(MAX_ROWS)
        ).data ?? []) as { title: string; created_at: string }[],
        parsed.data.from,
        parsed.data.to,
        // 어디서 온 정보인지 밝힌다 — 일정에 등록된 것과 구분돼야 한다.
      ).map((b) => ({ ...b, source: "backup_request" as const }))
    : [];

  // KST로 확정해 넘긴다. UTC 원본을 주면 모델이 "표기 기준에 따라 다를 수 있다"고
  // 헤아리는 답을 낸다 — 마감 시각을 묻는 사람에게 그건 쓸모가 없다(2026-08-19).
  return NextResponse.json({
    ok: true,
    timezone: "Asia/Seoul",
    events: (data ?? []).map(toKstEvent),
    backupAbsences,
  });
}
