"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import {
  devControlSpecItemSchema,
  requestDevControlSpecSchema,
  sendDevControlSpecSchema,
  toggleSpecItemSchema,
} from "./schemas";
import { buildSpecMailHtml, buildSpecSubject } from "./mail-html";

type Result = { ok: boolean; error?: string };

/**
 * 명세서 생성 요청 — 저장된 raw_code 로 만든다(수집을 다시 하지 않는다).
 *
 * 분석이 없으면 만들 게 없다. **조용히 빈 문서를 만들지 않고** 이유를 돌려준다.
 */
export async function requestDevControlSpec(input: unknown): Promise<Result> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = requestDevControlSpecSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const serviceId = parsed.data.serviceId;

  const admin = createAdminClient();
  const { data: analyses, error: aErr } = await admin
    .from("dev_control_analyses")
    .select("id")
    .eq("service_id", serviceId)
    .limit(1);
  if (aErr) return { ok: false, error: aErr.message };
  if (!analyses || analyses.length === 0)
    return {
      ok: false,
      error: "먼저 [지금 분석]으로 원서제어를 수집해 주세요",
    };

  // 같은 큐를 kind 로 나눠 쓴다 — 분석이든 명세든 Moa 로그인을 타는 폴러가 하나다.
  const { data: existing, error: qErr } = await admin
    .from("dev_control_analyze_requests")
    .select("id")
    .eq("service_id", serviceId)
    .in("status", ["pending", "running"])
    .limit(1);
  if (qErr) return { ok: false, error: qErr.message };
  if (existing && existing.length > 0)
    return { ok: false, error: "이미 대기/진행 중입니다" };

  const { error } = await admin.from("dev_control_analyze_requests").insert({
    service_id: serviceId,
    kind: "spec",
    requested_by: me.displayName ?? me.email ?? null,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}

/** 항목 포함/제외 — 끈 항목은 화면에 남고 메일에서만 빠진다. */
export async function toggleDevControlSpecItem(
  input: unknown,
): Promise<Result> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = toggleSpecItemSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("dev_control_specs")
    .select("id, items")
    .eq("service_id", parsed.data.serviceId)
    .single();
  if (error) return { ok: false, error: error.message };

  const items = z.array(devControlSpecItemSchema).safeParse(data.items);
  if (!items.success)
    return { ok: false, error: "저장된 명세 형식이 올바르지 않습니다" };

  const next = items.data.map((i) =>
    i.key === parsed.data.itemKey
      ? { ...i, included: parsed.data.included }
      : i,
  );
  const { error: upErr } = await admin
    .from("dev_control_specs")
    .update({ items: next })
    .eq("id", data.id);
  if (upErr) return { ok: false, error: upErr.message };
  revalidatePath("/dashboard/dev-test");
  return { ok: true };
}

/**
 * 학교 담당자에게 발송.
 *
 * **본문을 폼에서 받지 않는다** — 항목과 제외 결정을 DB 에서 다시 읽어 서버가
 * 조립한다. 폼을 믿으면 화면에서 끈 항목이 그대로 실려 나갈 수 있고, 학교로 나간
 * 메일은 되돌릴 수 없다(오픈안내가 오픈 시각을 DB 에서 다시 읽는 것과 같은 이유).
 */
export async function sendDevControlSpec(input: unknown): Promise<Result> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: "로그인이 필요합니다" };
  const parsed = sendDevControlSpecSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };
  const { serviceId, toEmail, toName, cc } = parsed.data;

  const admin = createAdminClient();
  const { data: spec, error: sErr } = await admin
    .from("dev_control_specs")
    .select("items, source_analyzed_at")
    .eq("service_id", serviceId)
    .single();
  if (sErr) return { ok: false, error: "명세서를 먼저 만들어 주세요" };

  const items = z.array(devControlSpecItemSchema).safeParse(spec.items);
  if (!items.success)
    return { ok: false, error: "저장된 명세 형식이 올바르지 않습니다" };

  // 대학·서비스명도 DB 에서 읽는다 — 문서 머리글이 폼에 따라 흔들리면 안 된다.
  const { data: svc } = await admin
    .from("services")
    .select("university_name, service_name")
    .eq("service_id", serviceId)
    .maybeSingle();
  const universityName = svc?.university_name ?? "";
  if (!universityName)
    return { ok: false, error: "서비스 정보를 찾을 수 없습니다" };

  const mailArgs = {
    universityName,
    serviceName: svc?.service_name ?? null,
    items: items.data,
    sourceAnalyzedAt: spec.source_analyzed_at,
  };

  let html: string;
  try {
    html = buildSpecMailHtml(mailArgs);
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const subject = buildSpecSubject(mailArgs);

  const dryRun = (process.env.MAIL_DRY_RUN ?? "true").toLowerCase() === "true";
  const sentBy = me.displayName ?? me.email ?? null;
  let status: "sent" | "dry_run" | "failed" = "dry_run";
  let errorMessage: string | null = null;

  if (!dryRun) {
    if (!me.email) return { ok: false, error: "발신자 메일 주소가 없습니다" };
    // 발신은 로그인한 운영자 본인 메일박스 — 사내 메일 표준.
    const result = await sendGraphMail({
      senderUserId: me.email,
      toEmail,
      toName,
      cc,
      subject,
      html,
    });
    status = result.ok ? "sent" : "failed";
    errorMessage = result.ok ? null : (result.error ?? "발송 실패");
  }

  // 보낸 그대로 남긴다 — 나중에 항목을 바꿔도 '그때 무엇을 보냈는지'가 흔들리면 안 된다.
  await admin.from("dev_control_spec_sends").insert({
    service_id: serviceId,
    university_name: universityName,
    to_email: toEmail,
    cc,
    subject,
    body_html: html,
    status,
    error_message: errorMessage,
    sent_by: sentBy,
  });

  revalidatePath("/dashboard/dev-test");
  return status === "failed"
    ? { ok: false, error: errorMessage ?? "발송 실패" }
    : { ok: true };
}
