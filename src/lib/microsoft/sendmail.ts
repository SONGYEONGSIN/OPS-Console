import "server-only";
import { getGraphToken } from "./auth";
import { BRAND_LOGO_CID, brandLogoAttachment } from "@/lib/mail/brand-logo";

export type SendMailResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export type GraphMailRecipient = {
  email: string;
  name?: string;
};

export type GraphMailAttachment = {
  /** 파일명 (확장자 포함, 예: "backup.pdf") */
  name: string;
  /** base64 인코딩된 콘텐츠 */
  contentBytes: string;
  /** MIME 타입 (예: "application/pdf") */
  contentType: string;
  /** 본문 인라인 이미지 여부 (cid 참조). true면 contentId 필요 */
  isInline?: boolean;
  /** 인라인 이미지 cid — HTML `<img src="cid:...">`의 ... 값 */
  contentId?: string;
};

export type SendGraphMailArgs = {
  /** Graph /users/{id}/sendMail 의 user — UPN (이메일) 또는 objectId */
  senderUserId: string;
  toEmail: string;
  toName?: string;
  /** CC 수신자 (선택) */
  cc?: GraphMailRecipient[];
  /** BCC 숨은 참조 수신자 (선택) */
  bcc?: GraphMailRecipient[];
  subject: string;
  /** HTML body (text 미지정 시 사용) */
  html?: string;
  /** 평문 body — 지정 시 contentType Text로 발송 (html보다 우선) */
  text?: string;
  /** 파일 첨부 (선택). Graph sendMail 본 호출은 합산 4MB 한도 */
  attachments?: GraphMailAttachment[];
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
  const {
    senderUserId,
    toEmail,
    toName,
    cc,
    bcc,
    subject,
    html,
    text,
    attachments,
  } = args;

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

  const toGraphRecipients = (list?: GraphMailRecipient[]) =>
    list && list.length > 0
      ? list.map((r) => ({
          emailAddress: r.name
            ? { address: r.email, name: r.name }
            : { address: r.email },
        }))
      : undefined;

  const ccRecipients = toGraphRecipients(cc);
  const bccRecipients = toGraphRecipients(bcc);

  // 본문이 브랜드 로고(cid)를 참조하면 인라인 로고 첨부를 자동 주입.
  // 발송 지점은 별도 변경 없이 brandLogoImg()를 헤더에 넣기만 하면 된다.
  const allAttachments = [...(attachments ?? [])];
  if (
    html &&
    html.includes(`cid:${BRAND_LOGO_CID}`) &&
    !allAttachments.some((a) => a.contentId === BRAND_LOGO_CID)
  ) {
    allAttachments.push(brandLogoAttachment());
  }

  const mailAttachments =
    allAttachments.length > 0
      ? allAttachments.map((a) => ({
          "@odata.type": "#microsoft.graph.fileAttachment",
          name: a.name,
          contentType: a.contentType,
          contentBytes: a.contentBytes,
          ...(a.isInline ? { isInline: true } : {}),
          ...(a.contentId ? { contentId: a.contentId } : {}),
        }))
      : undefined;

  const body =
    text != null
      ? { contentType: "Text", content: text }
      : { contentType: "HTML", content: html ?? "" };

  const message: Record<string, unknown> = {
    subject,
    body,
    toRecipients: [
      {
        emailAddress: toName
          ? { address: toEmail, name: toName }
          : { address: toEmail },
      },
    ],
  };
  if (ccRecipients) message.ccRecipients = ccRecipients;
  if (bccRecipients) message.bccRecipients = bccRecipients;
  if (mailAttachments) message.attachments = mailAttachments;

  const payload = {
    message,
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
