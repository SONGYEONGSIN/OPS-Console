"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { sendDataRequestInputSchema, dataRequestCcSchema } from "./schemas";
import { renderDataRequestHtml } from "./mail-template";

export type DataRequestActionState = { ok: boolean; message: string } | undefined;

export async function sendDataRequestAction(
  _prev: DataRequestActionState,
  formData: FormData,
): Promise<DataRequestActionState> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  const rawCc = formData.get("cc");
  let cc: { email: string; name?: string }[] = [];
  if (typeof rawCc === "string" && rawCc.trim()) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawCc);
    } catch {
      return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    }
    const parsedCc = z.array(dataRequestCcSchema).safeParse(parsedJson);
    if (!parsedCc.success) return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    cc = parsedCc.data;
  }

  const parsed = sendDataRequestInputSchema.safeParse({
    serviceId: (formData.get("serviceId") as string) || null,
    universityName: formData.get("universityName"),
    toEmail: formData.get("toEmail"),
    toName: (formData.get("toName") as string) || undefined,
    cc,
    subject: formData.get("subject"),
    body: formData.get("body"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const input = parsed.data;
  const serviceName = (formData.get("serviceName") as string) || null;

  const html = renderDataRequestHtml({
    subject: input.subject,
    body: input.body,
    universityName: input.universityName,
    serviceName,
  });

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  let status: "sent" | "failed" | "dry_run" = "sent";
  let error: string | null = null;

  if (dryRun) {
    status = "dry_run";
  } else {
    const result = await sendGraphMail({
      senderUserId: me.email,
      toEmail: input.toEmail,
      toName: input.toName,
      cc: input.cc,
      subject: input.subject,
      html,
    });
    if (!result.ok) {
      status = "failed";
      error = result.error;
    }
  }

  const supabase = createAdminClient();
  await supabase.from("data_request_sends").insert({
    service_id: input.serviceId ?? null,
    university_name: input.universityName,
    sender_email: me.email,
    to_email: input.toEmail,
    to_name: input.toName ?? null,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    status,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    error,
    created_by_email: me.email,
  });

  revalidatePath("/dashboard/data-requests");

  if (status === "failed") {
    return { ok: false, message: `발송 실패: ${error ?? "알 수 없는 오류"}` };
  }
  return {
    ok: true,
    message: dryRun ? "테스트 모드 — 실제 발송하지 않았습니다." : "발송되었습니다.",
  };
}
