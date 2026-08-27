import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { replyTextFor, type QueueRow } from "@/features/teams-bot/reply-text";
import { sendTeamsChatMessage } from "@/lib/microsoft/teams";

/**
 * 답이 준비된 건을 Teams 로 되돌려 준다. cron 이 1분마다 부른다.
 *
 * **회사 PC 폴러가 직접 Teams 로 보내지 않는다** — 폴러는 볼트를 읽는 일만 하고,
 * 채팅 발송 자격증명을 그 PC 에 늘리지 않는다.
 *
 * **Graph 로 그 방에 답을 올린다**(2026-08-27). Bot Framework 를 쓰던 때는 미리 올린
 * "찾아보는 중…"을 고쳐 썼지만, 봇 등록이 끝내 동작하지 않아 사람 계정으로 방에
 * 글을 쓰는 구조가 됐다. 고쳐 쓸 자리가 없으므로 **답이 준비됐을 때 한 번만** 쓴다.
 */

/** 한 번에 처리할 건수. 밀려도 다음 차례가 이어 받는다. */
const BATCH = 20;

/** 방에 글을 써 줄 사람. 폴링과 같은 계정이어야 같은 방에 닿는다. */
const READER = process.env.TEAMS_POLL_OPERATOR_EMAIL ?? "";

/**
 * 채팅 본문은 HTML 이다. 줄바꿈을 그대로 두면 답이 한 덩이로 붙어 읽기 어렵다.
 * 태그가 될 만한 글자는 먼저 막는다 — 답에 `<` 가 섞여 마크업으로 새면 안 된다.
 */
function toHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { ok: false, error: "unauthorized" },
      { status: 401 },
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("assistant_requests")
    .select(
      "id, status, answer, message, requested_at, teams_conversation_id, operator_email",
    )
    .not("teams_conversation_id", "is", null)
    .is("teams_replied_at", null)
    .order("requested_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 },
    );
  }

  let replied = 0;
  for (const row of (data ?? []) as (QueueRow & Record<string, string>)[]) {
    const text = replyTextFor(row);
    // 아직 도는 중 — 고쳐 쓸 것이 없다.
    if (!text) continue;

    let sent = false;
    try {
      await sendTeamsChatMessage({
        // 방에 글을 쓰는 것은 **읽어준 사람**의 자격이다. 물어본 사람이 아니다.
        operatorEmail: READER,
        chatId: row.teams_conversation_id,
        html: toHtml(text),
      });
      sent = true;
    } catch {
      // 못 보냈으면 표시하지 않는다 — 다음 차례가 다시 시도한다.
    }
    if (!sent) continue;

    await admin
      .from("assistant_requests")
      .update({ teams_replied_at: new Date().toISOString() })
      .eq("id", row.id);
    replied += 1;
  }

  return NextResponse.json({ ok: true, replied, scanned: data?.length ?? 0 });
}
