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

  // URLSearchParams는 $를 %24로 인코딩하므로 사용하지 않는다.
  // OData 키는 리터럴 $, 공백은 %20으로 직접 조합한다.
  const filterSuffix = since
    ? `&$filter=receivedDateTime%20gt%20${encodeURIComponent(since)}`
    : "";
  const url =
    `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(ownerEmail)}` +
    `/mailFolders/inbox/messages` +
    `?$top=${top}` +
    `&$orderby=receivedDateTime%20desc` +
    `&$select=id,subject,bodyPreview,body,from,receivedDateTime,isRead` +
    filterSuffix;

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
