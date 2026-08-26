import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyTextFor, type QueueRow } from "@/features/teams-bot/reply-text";
import { postActivity, updateActivity } from "@/lib/microsoft/bot-framework";

/**
 * 답이 준비된 건을 Teams 로 되돌려 준다. cron 이 1분마다 부른다.
 *
 * **회사 PC 폴러가 직접 Teams 로 보내지 않는다** — 폴러는 볼트를 읽는 일만 하고,
 * 채팅 발송 자격증명을 그 PC 에 늘리지 않는다.
 *
 * 올려둔 "찾아보는 중…"을 **고쳐 쓴다.** 새 메시지를 또 붙이면 여럿이 보는 채팅방에서
 * 봇이 두 줄씩 쌓아 대화를 민다. 고쳐 쓰기가 막힐 때만 새 메시지로 물러선다.
 */

/** 한 번에 처리할 건수. 밀려도 다음 차례가 이어 받는다. */
const BATCH = 20;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .select("id, status, answer, message, requested_at, teams_conversation_id, teams_service_url, teams_activity_id")
    .not("teams_activity_id", "is", null)
    .is("teams_replied_at", null)
    .order("requested_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let replied = 0;
  for (const row of (data ?? []) as (QueueRow & Record<string, string>)[]) {
    const text = replyTextFor(row);
    // 아직 도는 중 — 고쳐 쓸 것이 없다.
    if (!text) continue;

    const target = {
      serviceUrl: row.teams_service_url,
      conversationId: row.teams_conversation_id,
      text,
    };
    let sent = await updateActivity({ ...target, activityId: row.teams_activity_id });
    // 고쳐 쓰기가 막히면(권한·시간) 새 메시지로라도 답한다 — 사라지는 것보다 낫다.
    if (!sent) sent = Boolean(await postActivity(target));
    // 못 보냈으면 표시하지 않는다 — 다음 차례가 다시 시도한다.
    if (!sent) continue;

    await admin
      .from("assistant_requests")
      .update({ teams_replied_at: new Date().toISOString() })
      .eq("id", row.id);
    replied += 1;
  }

  return NextResponse.json({ ok: true, replied, scanned: data?.length ?? 0 });
}
