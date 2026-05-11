import "server-only";
import { getGraphToken } from "./auth";

export type SendMailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export type SendGraphMailArgs = {
  /** Graph /users/{id}/sendMail 의 user — UPN (이메일) 또는 objectId */
  senderUserId: string;
  toEmail: string;
  toName?: string;
  subject: string;
  /** HTML body */
  html: string;
};

/**
 * Microsoft Graph sendMail wrapper.
 *
 * - client_credentials 토큰 (`getGraphToken`) 재활용
 * - `/users/{senderUserId}/sendMail` POST
 * - saveToSentItems: true (발신자 'Sent Items' 폴더 저장)
 *
 * 호출자는 ok / error 분기로 처리. 401(권한)/429(rate)는 표준 에러 키로 반환.
 */
export async function sendGraphMail(
  args: SendGraphMailArgs,
): Promise<SendMailResult> {
  const { senderUserId, toEmail, toName, subject, html } = args;

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    return {
      ok: false,
      error: `token_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
    senderUserId,
  )}/sendMail`;

  const payload = {
    message: {
      subject,
      body: { contentType: "HTML", content: html },
      toRecipients: [
        {
          emailAddress: toName
            ? { address: toEmail, name: toName }
            : { address: toEmail },
        },
      ],
    },
    saveToSentItems: true,
  };

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    return {
      ok: false,
      error: `network_error: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (res.status === 202 || res.status === 200) {
    // Location 헤더에 "/messages/{id}" — id만 추출
    const loc = res.headers.get("Location") ?? "";
    const m = loc.match(/\/messages\/([^/]+)/);
    return { ok: true, messageId: m ? m[1] : undefined };
  }

  if (res.status === 401) {
    return { ok: false, error: `unauthorized: ${await safeText(res)}` };
  }
  if (res.status === 429) {
    return { ok: false, error: `rate_limited: ${await safeText(res)}` };
  }

  return {
    ok: false,
    error: `graph_${res.status}: ${await safeText(res)}`,
  };
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 500);
  } catch {
    return "";
  }
}
