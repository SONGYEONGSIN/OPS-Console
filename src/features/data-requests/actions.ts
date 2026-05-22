"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { sendDataRequestInputSchema, dataRequestCcSchema } from "./schemas";

export type DataRequestActionState = { ok: boolean; message: string } | undefined;

/** datetime-local(KST) 문자열 → UTC Date. 빈/잘못된 값 null. */
export function parseScheduledAtKst(value: string): Date | null {
  if (!value) return null;
  const hasSeconds = /T\d\d:\d\d:\d\d/.test(value);
  const normalized = (hasSeconds ? value : `${value}:00`) + "+09:00";
  const d = new Date(normalized);
  return Number.isNaN(d.getTime()) ? null : d;
}

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
    mode: (formData.get("mode") as string) || "now",
    scheduledAt: (formData.get("scheduledAt") as string) || undefined,
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }
  const input = parsed.data;

  // 예약 발송: 발송하지 않고 status='scheduled'로 적재 (pg_cron dispatch가 처리).
  if (input.mode === "schedule") {
    const when = parseScheduledAtKst(input.scheduledAt ?? "");
    if (!when) return { ok: false, message: "예약 시각을 선택하세요." };
    if (when.getTime() <= Date.now()) {
      return { ok: false, message: "예약 시각은 현재 이후여야 합니다." };
    }
    const supabase = createAdminClient();
    const { error: insertError } = await supabase.from("data_request_sends").insert({
      service_id: input.serviceId ?? null,
      university_name: input.universityName,
      sender_email: me.email,
      to_email: input.toEmail,
      to_name: input.toName ?? null,
      cc: input.cc,
      subject: input.subject,
      body: input.body,
      status: "scheduled",
      scheduled_at: when.toISOString(),
      created_by_email: me.email,
    });
    revalidatePath("/dashboard/data-requests");
    if (insertError) {
      return { ok: false, message: `예약 저장 실패: ${insertError.message}` };
    }
    return {
      ok: true,
      message: `예약되었습니다 (${new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(when)})`,
    };
  }

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
      text: input.body,
    });
    if (!result.ok) {
      status = "failed";
      error = result.error;
    }
  }

  const supabase = createAdminClient();
  const { error: insertError } = await supabase.from("data_request_sends").insert({
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
  const baseMsg = dryRun ? "테스트 모드 — 실제 발송하지 않았습니다." : "발송되었습니다.";
  return {
    ok: true,
    message: insertError ? `${baseMsg} (이력 저장 실패: ${insertError.message})` : baseMsg,
  };
}
