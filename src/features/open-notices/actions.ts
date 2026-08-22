"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { kstFormat } from "@/lib/kst-format";
import { getCurrentOperator } from "@/features/auth/queries";
import { parseScheduledAtKst } from "@/features/mail-sends/schedule-time";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { buildOpenNoticeHtml } from "./mail-html";
import { findOpenNoticeService } from "./queries";
import { sendOpenNoticeInputSchema, openNoticeCcSchema } from "./schemas";

export type OpenNoticeActionState = { ok: boolean; message: string } | undefined;

const REVALIDATE_PATH = "/dashboard/dev-test";

export async function sendOpenNoticeAction(
  _prev: OpenNoticeActionState,
  formData: FormData,
): Promise<OpenNoticeActionState> {
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
    const parsedCc = z.array(openNoticeCcSchema).safeParse(parsedJson);
    if (!parsedCc.success)
      return { ok: false, message: "참조(CC) 형식이 올바르지 않습니다." };
    cc = parsedCc.data;
  }

  const parsed = sendOpenNoticeInputSchema.safeParse({
    serviceId: formData.get("serviceId"),
    universityName: formData.get("universityName"),
    serviceName: (formData.get("serviceName") as string) || undefined,
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

  // 권한 — 본인 담당 건만. 폼이 아니라 DB 에서 담당자를 다시 읽는다.
  const service = await findOpenNoticeService(input.serviceId);
  if (!service) {
    return { ok: false, message: "서비스를 찾을 수 없습니다." };
  }
  const isAdmin = me.permission === "admin";
  const myName = me.operator?.name ?? null;
  if (!isAdmin && (!myName || service.operatorName !== myName)) {
    return { ok: false, message: "본인이 담당한 서비스만 발송할 수 있습니다." };
  }

  const supabase = createAdminClient();

  const baseRow = {
    service_id: input.serviceId,
    university_name: input.universityName,
    service_name: input.serviceName ?? service.serviceName,
    sender_email: me.email,
    to_email: input.toEmail,
    to_name: input.toName ?? null,
    cc: input.cc,
    subject: input.subject,
    body: input.body,
    created_by_email: me.email,
  };

  // 예약 발송: 지금 보내지 않고 status='scheduled' 로 적재 (dispatch 가 처리).
  if (input.mode === "schedule") {
    const when = parseScheduledAtKst(input.scheduledAt ?? "");
    if (!when) return { ok: false, message: "예약 시각을 선택하세요." };
    if (when.getTime() <= Date.now()) {
      return { ok: false, message: "예약 시각은 현재 이후여야 합니다." };
    }
    const { error: insertError } = await supabase.from("open_notice_sends").insert({
      ...baseRow,
      status: "scheduled",
      scheduled_at: when.toISOString(),
    });
    revalidatePath(REVALIDATE_PATH);
    if (insertError) {
      return { ok: false, message: `예약 저장 실패: ${insertError.message}` };
    }
    const at = kstFormat({
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(when);
    return { ok: true, message: `예약되었습니다 (${at})` };
  }

  const dryRun = process.env.MAIL_DRY_RUN === "true";
  let status: "sent" | "failed" | "dry_run" = "sent";
  let error: string | null = null;

  if (dryRun) {
    status = "dry_run";
  } else {
    // 발신 명의(본인)의 운영자 정보로 HTML 서명 생성.
    const { data: senderSig } = await supabase
      .from("operators")
      .select("name, department, team, role, phone")
      .eq("email", me.email)
      .maybeSingle();
    const result = await sendGraphMail({
      senderUserId: me.email,
      toEmail: input.toEmail,
      toName: input.toName,
      cc: input.cc,
      subject: input.subject,
      // buildReplyHtml 이 아니다 — 초안의 열 정렬이 연속 공백에 걸려 있다.
      html: buildOpenNoticeHtml(input.body, senderSig ?? {}),
    });
    if (!result.ok) {
      status = "failed";
      error = result.error;
    }
  }

  const { error: insertError } = await supabase.from("open_notice_sends").insert({
    ...baseRow,
    status,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    error,
  });

  revalidatePath(REVALIDATE_PATH);

  if (status === "failed") {
    return { ok: false, message: `발송 실패: ${error ?? "알 수 없는 오류"}` };
  }
  const baseMsg = dryRun
    ? "테스트 모드 — 실제 발송하지 않았습니다."
    : "발송되었습니다.";
  return {
    ok: true,
    message: insertError
      ? `${baseMsg} (이력 저장 실패: ${insertError.message})`
      : baseMsg,
  };
}
