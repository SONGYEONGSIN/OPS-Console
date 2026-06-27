"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { getCurrentOperator } from "@/features/auth/queries";
import { getQuoteDocument } from "./document-queries";
import { blankDocument } from "./document-schema";
import { renderQuotePdf } from "@/lib/pdf/quote-pdf";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { isValidEmail } from "@/lib/email";

const DRY_RUN = process.env.MAIL_DRY_RUN === "true";

/**
 * 견적서 PDF를 외부 수신자에게 메일 발송 (Microsoft Graph).
 * 발신자는 로그인한 운영자 메일박스. 수신자는 외부 이메일(고객 등)로, 이메일 형식만 허용.
 */
export async function sendQuoteMail(
  id: string,
  recipients: string[],
): Promise<{ ok: boolean; error?: string }> {
  const me = await getCurrentOperator();
  if (!me?.email) return { ok: false, error: "인증이 필요합니다." };
  if (recipients.length === 0) {
    return { ok: false, error: "수신자를 한 명 이상 지정하세요." };
  }
  const invalid = recipients.filter((r) => !isValidEmail(r));
  if (invalid.length > 0) {
    return {
      ok: false,
      error: `유효한 이메일이 아닙니다: ${invalid.join(", ")}`,
    };
  }

  const q = await getQuoteDocument(id);
  if (!q) return { ok: false, error: "견적서를 찾을 수 없습니다." };
  const document = q.document ?? blankDocument(q.quoteType);
  const name = document.header.quoteName || q.customer || "견적서";
  const subject = `[견적서] ${name}`;
  const pdf = Buffer.from(
    await renderToBuffer(renderQuotePdf({ document, customer: q.customer })),
  );
  const fileName = `견적서_${name}.pdf`;

  if (DRY_RUN) return { ok: true };

  const [toEmail, ...ccEmails] = recipients;
  const cc = ccEmails.map((email) => ({ email }));
  const res = await sendGraphMail({
    senderUserId: me.email,
    toEmail,
    cc: cc.length > 0 ? cc : undefined,
    subject,
    html: `<p>견적서를 전달드립니다. (${name})</p>`,
    attachments: [
      {
        name: fileName,
        contentBytes: pdf.toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}
