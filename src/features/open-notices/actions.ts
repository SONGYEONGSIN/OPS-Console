"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { kstFormat } from "@/lib/kst-format";
import { getCurrentOperator } from "@/features/auth/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { findOpenNoticeService } from "./queries";
import {
  openNoticeAutoSendInputSchema,
  openNoticeCancelInputSchema,
  openNoticeCcSchema,
} from "./schemas";

export type OpenNoticeActionState = { ok: boolean; message: string } | undefined;

const REVALIDATE_PATH = "/dashboard/dev-test";

type AuthResult =
  | { ok: false; message: string }
  | {
      ok: true;
      me: NonNullable<Awaited<ReturnType<typeof getCurrentOperator>>>;
      service: NonNullable<Awaited<ReturnType<typeof findOpenNoticeService>>>;
    };

/** 본인 담당(또는 admin)인지 DB 기준으로 판정. */
async function authorize(serviceId: number): Promise<AuthResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, message: "로그인이 필요합니다." };

  // 폼이 보낸 담당자명·시각을 믿지 않는다 — DB 에서 다시 읽는다.
  const service = await findOpenNoticeService(serviceId);
  if (!service) return { ok: false, message: "서비스를 찾을 수 없습니다." };

  const isAdmin = me.permission === "admin";
  const myName = me.operator?.name ?? null;
  if (!isAdmin && (!myName || service.operatorName !== myName)) {
    return { ok: false, message: "본인이 담당한 서비스만 설정할 수 있습니다." };
  }
  return { ok: true, me, service };
}

/**
 * 자동 발송 켜기 — 오픈 시각에 나가도록 예약 행을 만든다.
 *
 * 예약 시각은 폼이 아니라 `closing_services.write_start_at` 에서 읽는다.
 * dispatch 가 5분마다 만료 행을 집어가므로 실제 발송은 오픈 시각 ±5분이다.
 */
export async function enableOpenNoticeAutoSendAction(
  _prev: OpenNoticeActionState,
  formData: FormData,
): Promise<OpenNoticeActionState> {
  const rawCc = formData.get("cc");
  let cc: { email: string; name?: string }[] = [];
  if (typeof rawCc === "string" && rawCc.trim()) {
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawCc);
    } catch {
      return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    }
    const parsedCc = z.array(openNoticeCcSchema).safeParse(parsedJson);
    if (!parsedCc.success)
      return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    cc = parsedCc.data;
  }

  const parsed = openNoticeAutoSendInputSchema.safeParse({
    serviceId: formData.get("serviceId"),
    universityName: formData.get("universityName"),
    serviceName: (formData.get("serviceName") as string) || undefined,
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

  const auth = await authorize(input.serviceId);
  if (!auth.ok) return auth;
  const { me, service } = auth;

  if (!service.writeStartAt) {
    return { ok: false, message: "오픈 시각이 없어 자동 발송을 켤 수 없습니다." };
  }
  const when = new Date(service.writeStartAt);
  if (Number.isNaN(when.getTime())) {
    return { ok: false, message: "오픈 시각을 읽을 수 없습니다." };
  }
  if (when.getTime() <= Date.now()) {
    return {
      ok: false,
      message: "오픈 시각이 이미 지나 자동 발송을 켤 수 없습니다.",
    };
  }

  const supabase = createAdminClient();

  // 켜고 끄고를 반복해도 예약이 겹치지 않도록 기존 대기 행을 먼저 지운다.
  await supabase
    .from("open_notice_sends")
    .delete()
    .eq("service_id", input.serviceId)
    .eq("status", "scheduled");

  const { error: insertError } = await supabase.from("open_notice_sends").insert({
    service_id: input.serviceId,
    university_name: input.universityName,
    service_name: input.serviceName ?? service.serviceName,
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

  revalidatePath(REVALIDATE_PATH);
  if (insertError) {
    return { ok: false, message: `설정 저장 실패: ${insertError.message}` };
  }
  const at = kstFormat({
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(when);
  return { ok: true, message: `자동 발송 켬 — ${at} 오픈 시각에 발송됩니다.` };
}

/** 자동 발송 끄기 — 아직 안 나간 예약 행을 지운다. 이미 나간 이력은 남긴다. */
export async function disableOpenNoticeAutoSendAction(
  _prev: OpenNoticeActionState,
  formData: FormData,
): Promise<OpenNoticeActionState> {
  const parsed = openNoticeCancelInputSchema.safeParse({
    serviceId: formData.get("serviceId"),
  });
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0].message };
  }

  const auth = await authorize(parsed.data.serviceId);
  if (!auth.ok) return auth;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("open_notice_sends")
    .delete()
    .eq("service_id", parsed.data.serviceId)
    .eq("status", "scheduled");

  revalidatePath(REVALIDATE_PATH);
  if (error) return { ok: false, message: `해제 실패: ${error.message}` };
  return { ok: true, message: "자동 발송을 껐습니다." };
}
