import "server-only";

/**
 * Bot Framework 로 채팅 메시지를 올리고 고쳐 쓴다.
 *
 * 두 번 쓰는 이유: Teams 는 메시징 엔드포인트가 **15초 안에** 응답하기를 기대하는데
 * 우리 어시스턴트는 6~40초다(회사 PC 가 볼트를 하나씩 읽는다). 그래서 먼저
 * "찾아보는 중"을 올려 두고, 답이 준비되면 **그 메시지를 고쳐 쓴다.**
 *
 * 새 메시지를 또 붙이지 않는 이유: 채팅방은 여럿이 보는 자리라 봇이 두 줄씩 쌓으면
 * 대화가 밀린다. 고쳐 쓰면 한 줄로 끝난다.
 *
 * 실패는 던지지 않고 `null`/`false` 로 돌려준다 — 채팅 한 건 때문에 라우트가 500 이
 * 되면 그 방의 다른 질문까지 막힌다.
 */

const TOKEN_URL =
  "https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token";
const SCOPE = "https://api.botframework.com/.default";

/** 토큰은 한 시간 산다 — 메시지마다 발급하면 15초 예산을 네트워크로 쓴다. */
let cached: { token: string; until: number } | null = null;

async function getBotToken(): Promise<string | null> {
  if (cached && Date.now() < cached.until) return cached.token;

  const id = process.env.TEAMS_BOT_APP_ID;
  const pw = process.env.TEAMS_BOT_APP_PASSWORD;
  if (!id || !pw) return null;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: id,
      client_secret: pw,
      scope: SCOPE,
    }),
  });
  if (!res.ok) return null;
  const t = (await res.json()) as { access_token?: string; expires_in?: number };
  if (!t.access_token) return null;

  // 만료 1분 전에 버린다 — 경계에서 401 이 나면 답이 통째로 사라진다.
  cached = { token: t.access_token, until: Date.now() + ((t.expires_in ?? 3600) - 60) * 1000 };
  return cached.token;
}

/** `serviceUrl` 끝의 슬래시가 겹치지 않게 이어 붙인다. */
function activitiesUrl(serviceUrl: string, conversationId: string, activityId?: string) {
  const base = serviceUrl.replace(/\/+$/, "");
  const conv = encodeURIComponent(conversationId);
  return `${base}/v3/conversations/${conv}/activities${activityId ? `/${encodeURIComponent(activityId)}` : ""}`;
}

type Target = { serviceUrl: string; conversationId: string; text: string };

/** 메시지를 올리고 activity id 를 돌려준다. 실패하면 null. */
export async function postActivity(t: Target): Promise<string | null> {
  const token = await getBotToken();
  if (!token) return null;
  try {
    const res = await fetch(activitiesUrl(t.serviceUrl, t.conversationId), {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "message", text: t.text }),
    });
    if (!res.ok) return null;
    const b = (await res.json()) as { id?: string };
    return b.id ?? null;
  } catch {
    return null;
  }
}

/** 올려둔 메시지를 고쳐 쓴다. 막히면 false — 호출부가 새 메시지로 물러선다. */
export async function updateActivity(
  t: Target & { activityId: string },
): Promise<boolean> {
  const token = await getBotToken();
  if (!token) return false;
  try {
    const res = await fetch(activitiesUrl(t.serviceUrl, t.conversationId, t.activityId), {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ type: "message", text: t.text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
