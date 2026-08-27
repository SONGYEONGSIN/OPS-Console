import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listMyChats, listChatMessages } from "@/lib/microsoft/teams";
import { pickNewMessages, nextCursor } from "@/features/teams-bot/poll-plan";
import { emailFromAadObjectId } from "@/features/teams-bot/resolve-email";
import { allowedChats } from "@/features/teams-bot/chat-allow";
import { deliverPending } from "@/features/teams-bot/deliver";

/**
 * Teams 채팅을 훑어 **명보를 부른 말**을 큐에 넣는다. cron 이 1분마다 부른다.
 *
 * 봇 등록(Bot Framework)이 끝내 동작하지 않아 Graph 폴링으로 왔다(2026-08-27).
 * **사람 계정의 위임 토큰**으로 읽으므로 그 사람이 들어가 있는 방만 보인다.
 *
 * 답은 여기서 하지 않는다 — `/api/teams/flush` 가 회사 PC 에이전트의 답을 받아
 * 그 방에 올린다. 읽는 일과 쓰는 일을 갈라 둬야 한쪽이 막혀도 다른 쪽이 산다.
 */

/** 채팅을 읽어 줄 사람. 이 사람이 들어가 있는 방만 명보를 부를 수 있다. */
const READER = process.env.TEAMS_POLL_OPERATOR_EMAIL ?? "";

/**
 * 한 번에 볼 방 수.
 *
 * `listMyChats` 가 최대 50개를 준다. 여기서 더 줄이면 **뒤쪽 방이 조용히 빠져**
 * 그 방에서 부른 사람은 영영 답을 못 받는다 — 왜 안 되는지 알 방법도 없다.
 */
const MAX_CHATS = 50;

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!READER) {
    return NextResponse.json(
      { ok: false, error: "TEAMS_POLL_OPERATOR_EMAIL 미설정" },
      { status: 500 },
    );
  }

  const admin = createAdminClient();
  let queued = 0;
  let scanned = 0;
  let skipped = 0;
  // 적재 실패를 응답에 담는다 — 숫자만 보면 "왜 0인가"를 알 수 없다.
  const failed: string[] = [];

  // 허용한 방만 본다. 비어 있으면 아무 방도 열지 않는다 — 설정 누락이
  // 전 채팅방 개방이 되는 쪽이 훨씬 나쁘다.
  const chats = allowedChats(
    (await listMyChats(READER)).slice(0, MAX_CHATS),
    process.env.TEAMS_POLL_CHAT_IDS,
  );
  if (chats.length === 0) {
    return NextResponse.json({ ok: true, chats: 0, note: "허용된 방 없음 (TEAMS_POLL_CHAT_IDS)" });
  }
  for (const chat of chats) {
    // 커서가 없는 방은 **지금부터** 본다. 옛 대화에 뒤늦게 답하면 방이 어지러워진다.
    const { data: cursorRow } = await admin
      .from("teams_chat_cursors")
      .select("last_seen_at")
      .eq("chat_id", chat.id)
      .maybeSingle();
    const cursor = (cursorRow as { last_seen_at: string } | null)?.last_seen_at ?? null;

    let rows: unknown[] = [];
    try {
      rows = await listChatMessages({ operatorEmail: READER, chatId: chat.id });
    } catch {
      // 한 방이 막혀도 나머지는 본다 — 권한이 빠진 방이 섞여 있을 수 있다.
      continue;
    }
    scanned += rows.length;

    for (const called of pickNewMessages(rows, cursor)) {
      const email = await emailFromAadObjectId(called.aadObjectId);
      // 명부 밖이면 조용히 지나간다. 채팅방은 여럿이 보는 자리라 매번 거절을
      // 적으면 그게 더 시끄럽다 — 부른 사람에게는 답이 없는 것으로 보인다.
      if (!email) continue;
      const { data: known } = await admin
        .from("operators").select("email").eq("email", email).maybeSingle();
      if (!known) continue;

      const { error } = await admin.from("assistant_requests").insert({
        operator_email: email,
        question: called.question,
        page_context: "Teams 채팅",
        history: [],
        teams_conversation_id: chat.id,
        teams_source_message_id: called.messageId,
      });
      if (!error) {
        queued += 1;
      } else if (error.code === "23505") {
        // 같은 메시지를 두 번 넣으면 unique 인덱스가 막는다 — 그건 정상이다.
        skipped += 1;
      } else {
        // **이건 정상이 아니다.** 조용히 넘기면 질문이 사라진 채 아무도 모른다.
        failed.push(error.message.slice(0, 120));
      }
    }

    const moved = nextCursor(rows, cursor ?? new Date().toISOString());
    await admin.from("teams_chat_cursors").upsert({
      chat_id: chat.id,
      last_seen_at: moved,
      topic: chat.topic ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  // **읽고 나서 바로 내보낸다.** 별개 cron 으로 두면 대기가 두 번이라 답이
  // 1분 이상 늦는다(2026-08-27). 여기서 나가는 건 이전 주기에 물어본 것들이다.
  let delivered = { replied: 0, scanned: 0 };
  try {
    delivered = await deliverPending();
  } catch (e) {
    failed.push(`게시 실패: ${e instanceof Error ? e.message : e}`);
  }

  return NextResponse.json({
    ok: failed.length === 0,
    replied: delivered.replied,
    chats: chats.length,
    scanned,
    queued,
    // 이미 처리한 건. 0 이 아니라고 놀랄 일이 아니다.
    skipped,
    ...(failed.length ? { failed } : {}),
  });
}
