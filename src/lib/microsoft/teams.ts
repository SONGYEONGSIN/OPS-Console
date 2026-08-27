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

/**
 * 발신자 ↔ 대상 운영자의 1:1 채팅 id. 이미 있으면 Graph가 기존 채팅을 돌려준다(멱등).
 *
 * 대상은 UPN(메일 주소)으로 바인딩해 사용자 조회를 한 번 아낀다. 본인과의 self
 * 채팅은 Graph가 거부하므로(2인 필수) 관리자 알림 채널은 chatId를 직접 설정한다.
 */
export async function ensureOneOnOneChat(args: {
  operatorEmail: string;
  targetEmail: string;
}): Promise<string> {
  const token = await getDelegatedGraphToken(args.operatorEmail, {
    scope: TEAMS_SCOPE,
  });
  if (!token) throw new Error("Teams 위임 토큰 없음 (MS 재인증/동의 필요)");
  const member = (email: string) => ({
    "@odata.type": "#microsoft.graph.aadUserConversationMember",
    roles: ["owner"],
    "user@odata.bind": `${GRAPH}/users('${email}')`,
  });
  const res = await fetch(`${GRAPH}/chats`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [member(args.operatorEmail), member(args.targetEmail)],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `[teams] chat ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return ((await res.json()) as { id: string }).id;
}

/** Teams 채팅에 HTML 메시지 전송 (위임 토큰 — Chat.ReadWrite). */
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

/**
 * 방의 최근 메시지 — Graph 폴링이 읽는 자리.
 *
 * 봇 등록이 막혀 사람 계정으로 채팅을 읽는다(2026-08-27). 그래서 **그 사람이
 * 들어가 있는 방만** 보인다.
 *
 * 최신순으로 온다. 물어본 순서대로 처리하는 건 `poll-plan` 이 한다.
 */
export async function listChatMessages(args: {
  operatorEmail: string;
  chatId: string;
  top?: number;
}): Promise<unknown[]> {
  const token = await getDelegatedGraphToken(args.operatorEmail, {
    scope: TEAMS_SCOPE,
  });
  if (!token) throw new Error("Teams 위임 토큰 없음 (MS 재인증/동의 필요)");
  const res = await fetch(
    `${GRAPH}/chats/${encodeURIComponent(args.chatId)}/messages?$top=${args.top ?? 20}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!res.ok) {
    throw new Error(
      `[teams] messages ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return ((await res.json()) as { value?: unknown[] }).value ?? [];
}
