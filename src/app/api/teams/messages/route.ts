import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readActivity } from "@/features/teams-bot/activity";
import { emailFromAadObjectId } from "@/features/teams-bot/resolve-email";
import { verifyBotToken } from "@/features/teams-bot/verify-token";
import { postActivity } from "@/lib/microsoft/bot-framework";

/**
 * Teams 봇 메시징 엔드포인트.
 *
 * 채팅방의 질문을 웹 어시스턴트와 **같은 큐**에 넣는다. 15초 안에 답할 수 없으므로
 * (우리 답은 6~40초) 여기서는 적재까지만 하고 "찾아보는 중"을 올린다.
 * 답이 준비되면 `/api/teams/flush` 가 **그 메시지를 고쳐 쓴다.**
 *
 * **거의 모든 경우에 200 을 돌려준다.** Teams 는 실패를 재시도로 갚아서, 오류를
 * 돌려주면 같은 질문이 큐에 여러 번 쌓인다. 사람에게 알릴 일은 채팅으로 적는다.
 * 예외는 검증 실패(401) — 그건 우리 요청이 아니므로 재시도돼도 상관없다.
 */

const STILL_LOOKING = "찾아보는 중…";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const serviceUrl =
    typeof (body as { serviceUrl?: unknown } | null)?.serviceUrl === "string"
      ? (body as { serviceUrl: string }).serviceUrl
      : "";

  // 주소가 공개돼 있어 이게 유일한 관문이다. 없으면 아무나 남의 이름으로 물을 수 있다.
  const appId = process.env.TEAMS_BOT_APP_ID ?? "";
  const verified = await verifyBotToken(
    request.headers.get("authorization"),
    appId,
    serviceUrl,
  );
  if (!verified.ok) {
    console.warn(`[teams] 검증 실패: ${verified.reason}`);
    return NextResponse.json({ ok: false, error: verified.reason }, { status: 401 });
  }

  const read = readActivity(body, appId);
  if (!read.ok) {
    // **거절도 남긴다.** 조용히 200 만 돌려주던 때, 요청은 오는데 아무 일도 안 나는
    // 상태가 되어 원인을 못 찾고 네 시간을 설정만 뒤졌다(2026-08-26).
    // "왔지만 안 했다"는 "안 왔다"와 로그에서 구분돼야 한다.
    console.warn(`[teams] 건너뜀: ${read.reason}`);
    return NextResponse.json({ ok: true, skipped: read.reason });
  }

  const reply = { serviceUrl: read.serviceUrl, conversationId: read.conversationId };

  // Teams 는 이메일을 주지 않는다 — 디렉터리 id 로 오므로 한 번 바꾼다.
  const email = await emailFromAadObjectId(read.aadObjectId);
  const admin = createAdminClient();
  const known = email
    ? (await admin.from("operators").select("email").eq("email", email).maybeSingle()).data
    : null;

  if (!known) {
    // 조용히 무시하면 봇이 죽은 줄 안다. 다만 왜 안 되는지만 짧게 적는다.
    await postActivity({
      ...reply,
      text: "운영부 명부에 없는 계정이라 답할 수 없습니다. 내부 기록을 다루는 자리라 명부에 있는 분만 쓸 수 있어요.",
    });
    console.warn(`[teams] 명부 밖: ${email ?? read.aadObjectId}`);
    return NextResponse.json({ ok: true, skipped: "명부 밖" });
  }

  // 먼저 자리를 잡아 둔다 — 이 id 를 나중에 고쳐 쓴다.
  const activityId = await postActivity({ ...reply, text: STILL_LOOKING });

  const { data, error } = await admin
    .from("assistant_requests")
    .insert({
      operator_email: email,
      question: read.question,
      // 채팅방은 여럿이 보는 자리다. 모델이 그걸 알고 답을 쓴다.
      page_context: "Teams 채팅",
      history: [],
      teams_conversation_id: read.conversationId,
      teams_service_url: read.serviceUrl,
      teams_activity_id: activityId,
    })
    .select("id")
    .single();

  if (error || !data) {
    // 적재가 안 됐으면 "찾아보는 중"이 영영 남는다 — 그 자리에 사실을 적는다.
    await postActivity({ ...reply, text: "질문을 접수하지 못했습니다. 잠시 뒤 다시 불러주세요." });
    return NextResponse.json({ ok: true, error: error?.message ?? "적재 실패" });
  }

  return NextResponse.json({ ok: true, id: (data as { id: string }).id });
}
