import "server-only";
import { getGraphToken } from "./auth";

export type InboxMessage = {
  graphMessageId: string;
  fromName: string | null;
  fromEmail: string | null;
  subject: string | null;
  bodyPreview: string | null;
  body: string | null;
  receivedAt: string | null;
  isRead: boolean;
};

export type GetInboxResult =
  | { ok: true; messages: InboxMessage[] }
  | { ok: false; error: string };

type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  body?: { content?: string };
  from?: { emailAddress?: { name?: string; address?: string } };
  receivedDateTime?: string;
  isRead?: boolean;
};

/**
 * Microsoft Graph 수신함 조회 (Application 토큰, Mail.Read).
 * GET /users/{ownerEmail}/mailFolders/inbox/messages
 * since(ISO) 지정 시 receivedDateTime gt 증분. sendmail.ts 에러 패턴 차용.
 */
export async function getInboxMessages(
  ownerEmail: string,
  since?: string,
  top = 50,
): Promise<GetInboxResult> {
  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return {
      ok: false,
      error: `token_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const params = new URLSearchParams();
  params.set("$top", String(top));
  params.set("$orderby", "receivedDateTime desc");
  params.set(
    "$select",
    "id,subject,bodyPreview,body,from,receivedDateTime,isRead",
  );
  // URLSearchParams는 공백을 '+'로 인코딩 — Graph가 허용. (sendmail.ts와 동일 fetch 스타일)
  // $filter의 ISO 타임스탬프 내 ':'는 인코딩하지 않도록 raw append
  const filterSuffix = since
    ? `&%24filter=receivedDateTime+gt+${since}`
    : "";
  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    ownerEmail,
  )}/mailFolders/inbox/messages?${params.toString()}${filterSuffix}`;

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    return {
      ok: false,
      error: `network_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 401)
    return { ok: false, error: `unauthorized: ${await safeText(res)}` };
  if (res.status === 429)
    return { ok: false, error: `rate_limited: ${await safeText(res)}` };
  if (res.status !== 200)
    return { ok: false, error: `graph_${res.status}: ${await safeText(res)}` };

  const json = (await res.json()) as { value?: GraphMessage[] };
  const messages: InboxMessage[] = (json.value ?? []).map((m) => ({
    graphMessageId: m.id,
    fromName: m.from?.emailAddress?.name ?? null,
    fromEmail: m.from?.emailAddress?.address ?? null,
    subject: m.subject ?? null,
    bodyPreview: m.bodyPreview ?? null,
    body: m.body?.content ?? null,
    receivedAt: m.receivedDateTime ?? null,
    isRead: m.isRead ?? false,
  }));
  return { ok: true, messages };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
