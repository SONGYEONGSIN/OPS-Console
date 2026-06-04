import "server-only";
import { getDelegatedGraphToken } from "./delegated-token";

/**
 * Microsoft Teams — 그룹채팅 메시지 전송 / 채팅 목록.
 *
 * `POST /chats/{id}/messages` 는 application(앱 전용) 권한을 지원하지 않으므로
 * **위임(delegated) 토큰**(로그인 운영자 컨텍스트)이 필요하다. Azure 앱에
 * `Chat.ReadWrite` 위임 권한 + 관리자 동의가 선행돼야 한다.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";
// Teams 전용 위임 스코프 — 기존 SharePoint 위임 기능과 분리(공유 스코프 변경 시
// 동의 전 기존 기능이 깨지는 것을 방지).
const TEAMS_SCOPE = "offline_access Chat.ReadWrite";

export type TeamsChatSummary = {
  id: string;
  topic: string | null;
  chatType: string;
};

/** 내 Teams 채팅 목록 — TEAMS_CHAT_ID 값을 찾기 위한 헬퍼. */
export async function listMyChats(
  operatorEmail: string,
): Promise<TeamsChatSummary[]> {
  const token = await getDelegatedGraphToken(operatorEmail, {
    scope: TEAMS_SCOPE,
  });
  if (!token) throw new Error("Teams 위임 토큰 없음 (MS 재인증/동의 필요)");
  const res = await fetch(`${GRAPH}/me/chats?$top=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(
      `[teams] chats ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    value: Array<{ id: string; topic?: string | null; chatType?: string }>;
  };
  return json.value.map((c) => ({
    id: c.id,
    topic: c.topic ?? null,
    chatType: c.chatType ?? "",
  }));
}

/** Teams 그룹채팅에 HTML 메시지 전송 (위임 토큰 — Chat.ReadWrite). */
export async function sendTeamsChatMessage(args: {
  operatorEmail: string;
  chatId: string;
  html: string;
}): Promise<{ id: string }> {
  const token = await getDelegatedGraphToken(args.operatorEmail, {
    scope: TEAMS_SCOPE,
  });
  if (!token) throw new Error("Teams 위임 토큰 없음 (MS 재인증/동의 필요)");
  const res = await fetch(
    `${GRAPH}/chats/${encodeURIComponent(args.chatId)}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        body: { contentType: "html", content: args.html },
      }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `[teams] send ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return (await res.json()) as { id: string };
}
