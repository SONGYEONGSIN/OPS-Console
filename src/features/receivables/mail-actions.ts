"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOperator } from "@/features/auth/queries";
import { sendGraphMail } from "@/lib/microsoft/sendmail";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendReminderInputSchema,
  type SendReminderInput,
  type SendReminderItemResult,
  type SendReminderResult,
  type ReminderGroup,
} from "./mail-schemas";
import { buildReminderHtml, buildReminderSubject } from "./mail-template";
import { findGroupForEmail, type FindGroupForEmailResult } from "./mail-queries";
import { canSendOn } from "./mail-schedule";
import { fetchKoreanHolidays } from "@/lib/holidays/google-ical";

/**
 * 인스펙터에서 호출 — 특정 학교담당자 이메일로 묶이는 그룹 후보 조회.
 * 클라이언트 컴포넌트에서 server action으로 호출 가능하도록 wrapping.
 */
export async function fetchReminderGroup(
  email: string,
): Promise<FindGroupForEmailResult> {
  return findGroupForEmail(email);
}

const COMPANY_FALLBACK = "Folio";

function readCompanyName(): string {
  return process.env.MAIL_COMPANY_NAME?.trim() || COMPANY_FALLBACK;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type InsertRow = {
  sent_at: string;
  sender_operator_id: string | null;
  recipient_email: string;
  recipient_name: string | null;
  customer_names: string[];
  receivable_count: number;
  total_amount: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

function rowFor(
  group: ReminderGroup,
  itemResult: SendReminderItemResult,
  senderOperatorId: string | null,
): InsertRow {
  const uniqueCustomers = Array.from(
    new Set(group.items.map((it) => it.customerName).filter(Boolean)),
  );
  return {
    sent_at: new Date().toISOString(),
    sender_operator_id: senderOperatorId,
    recipient_email: group.recipient.email,
    recipient_name: group.recipient.name ?? null,
    customer_names: uniqueCustomers,
    receivable_count: group.items.length,
    total_amount: group.totalAmount,
    graph_message_id: itemResult.graphMessageId ?? null,
    status: itemResult.status,
    error_message: itemResult.errorMessage ?? null,
  };
}

/**
 * 학교담당자별 독려 메일 일괄 발송 (admin only).
 *
 * 1. zod parse → 실패 시 즉시 거부
 * 2. 권한 검사 (admin 만)
 * 3. dryRun=true: sendGraphMail 호출 안 함, 이력만 status=dry_run 으로 적재
 * 4. dryRun=false: 그룹별 Graph sendMail 호출 (1초 throttle), 이력 적재
 * 5. 이력은 service_role admin client 로 RLS 우회 insert
 */
export async function sendReminderEmails(
  rawInput: SendReminderInput,
): Promise<SendReminderResult> {
  const parsed = sendReminderInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: `입력 검증 실패: ${parsed.error.issues[0].message}`,
    };
  }
  const input = parsed.data;

  const me = await getCurrentOperator();
  if (!me || me.permission !== "admin") {
    return {
      ok: false,
      error: "권한 없음 — admin 운영자만 발송할 수 있습니다.",
    };
  }

  // 주말·공휴일 차단 (원본 GAS 규칙). 실발송만 — dryRun 테스트는 언제든 허용.
  if (!input.dryRun) {
    const holidays = await fetchKoreanHolidays();
    if (!canSendOn(new Date(), holidays)) {
      return {
        ok: false,
        error: "주말·공휴일에는 미수 독려 메일을 발송할 수 없습니다.",
      };
    }
  }

  const admin = createAdminClient();

  // 발신 operator의 id 조회 (이력 적재용 — 없으면 null 허용)
  let senderOperatorId: string | null = null;
  try {
    const { data: opRow } = await admin
      .from("operators")
      .select("id")
      .eq("email", me.email)
      .maybeSingle();
    senderOperatorId = (opRow as { id: string } | null)?.id ?? null;
  } catch {
    senderOperatorId = null;
  }

  const companyName = readCompanyName();
  const senderName = me.displayName || "관리자";

  const itemResults: SendReminderItemResult[] = [];
  const insertRows: InsertRow[] = [];

  for (let i = 0; i < input.groups.length; i++) {
    const group = input.groups[i];

    if (input.dryRun) {
      const r: SendReminderItemResult = {
        recipientEmail: group.recipient.email,
        status: "dry_run",
      };
      itemResults.push(r);
      insertRows.push(rowFor(group, r, senderOperatorId));
      continue;
    }

    const subject = buildReminderSubject({ group, companyName });
    const html = buildReminderHtml({ group, senderName, companyName });

    const sendRes = await sendGraphMail({
      senderUserId: me.email,
      toEmail: group.recipient.email,
      toName: group.recipient.name,
      subject,
      html,
    });

    const itemResult: SendReminderItemResult = sendRes.ok
      ? {
          recipientEmail: group.recipient.email,
          status: "sent",
          graphMessageId: sendRes.messageId,
        }
      : {
          recipientEmail: group.recipient.email,
          status: "failed",
          errorMessage: sendRes.error,
        };
    itemResults.push(itemResult);
    insertRows.push(rowFor(group, itemResult, senderOperatorId));

    // 1초 throttle (마지막 그룹 후 sleep 생략)
    if (i < input.groups.length - 1) {
      await sleep(1000);
    }
  }

  // 이력 일괄 insert — RLS 우회 (service_role)
  if (insertRows.length > 0) {
    await admin.from("receivables_mail_sends").insert(insertRows);
  }

  revalidatePath("/dashboard/receivables");

  return {
    ok: true,
    sentCount: itemResults.filter((r) => r.status === "sent").length,
    failedCount: itemResults.filter((r) => r.status === "failed").length,
    dryRunCount: itemResults.filter((r) => r.status === "dry_run").length,
    results: itemResults,
  };
}
