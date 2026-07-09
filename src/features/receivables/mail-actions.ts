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
  type OperatorReminderGroup,
} from "./mail-schemas";
import { buildReminderHtml, buildReminderSubject } from "./mail-template";
import {
  findGroupForEmail,
  readThresholdDays,
  type FindGroupForEmailResult,
} from "./mail-queries";
import { canSendOn } from "./mail-schedule";
import { fetchReceivablesSheet } from "./queries";
import { groupOwnerByOperator, findMailSentDateCol } from "./mail-grouping";
import { markReceivablesMailSent } from "./actions";
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

function todayKstYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

type InsertRow = {
  sent_at: string;
  sender_operator_id: string | null;
  triggered_by: string | null;
  recipient_email: string;
  recipient_name: string | null;
  customer_names: string[];
  receivable_count: number;
  total_amount: number;
  graph_message_id: string | null;
  status: "sent" | "failed" | "dry_run";
  error_message: string | null;
};

/**
 * scope='single' 이면 지정 거래처 1건만 남긴 그룹으로 축소.
 * 대상 행이 어느 그룹에도 없으면(= 매핑 실패로 blocked) 빈 배열 → 호출자가 차단.
 */
function narrowToScope(
  groups: OperatorReminderGroup[],
  input: SendReminderInput,
): OperatorReminderGroup[] {
  if (input.scope === "bundle") return groups;

  for (const group of groups) {
    const item = group.items.find(
      (it) => it.customerName === input.customerName,
    );
    if (item) {
      return [{ ...group, items: [item], totalAmount: item.amount }];
    }
  }
  return [];
}

/**
 * 학교담당자별 독려 메일 발송 (admin only).
 *
 * 발신 메일박스는 **채권 담당 운영자 본인** — admin이 대신 눌러도 운영자 이름으로 나간다.
 * 한 학교담당자에 여러 운영자의 청구건이 걸리면 운영자별로 분리해 N통 발송한다.
 *
 * 1. zod parse → 실패 시 즉시 거부
 * 2. 권한 검사 (admin 만)
 * 3. 주말·공휴일 차단 (실발송만 — dryRun 테스트는 언제든 허용)
 * 4. **서버가 시트를 재조회해 그룹·발신자를 재도출** — 클라이언트 입력을 신뢰하면
 *    임의 운영자 메일박스로 발송하는 사칭이 가능해진다
 * 5. 운영자 이메일 매핑 실패 행은 발송하지 않고 blockedCount로 보고 (그룹 단위 격리)
 * 6. 그룹별 Graph sendMail (1초 throttle) → 이력 적재 (service_role, RLS 우회)
 * 7. 발송 성공 행에 Excel '메일발송일자' 기록
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

  const sheet = await fetchReceivablesSheet();
  if (!sheet) {
    return {
      ok: false,
      error: "SharePoint 미수채권 시트를 가져오지 못했습니다.",
    };
  }

  // 발신자·그룹 재도출 — 클라이언트가 보낸 값은 수신자/범위 지정에만 쓴다.
  const { groups: allGroups, blocked } = groupOwnerByOperator(
    sheet,
    readThresholdDays(),
  );
  const normalized = input.recipientEmail.trim().toLowerCase();
  const mine = allGroups.filter(
    (g) => g.recipient.email.toLowerCase() === normalized,
  );
  const blockedCount = blocked.filter(
    (b) => b.recipientEmail?.toLowerCase() === normalized,
  ).length;

  const groups = narrowToScope(mine, input);
  if (groups.length === 0) {
    return {
      ok: false,
      error:
        blockedCount > 0
          ? "발송 가능한 운영자 매핑이 없습니다. 시트의 운영자명을 확인하세요."
          : "발송 대상 청구건을 찾지 못했습니다.",
    };
  }

  const admin = createAdminClient();
  const companyName = readCompanyName();

  // 발신 운영자 email → operators.id (이력 sender_operator_id)
  const senderEmails = Array.from(new Set(groups.map((g) => g.sender.email)));
  const idByEmail = new Map<string, string>();
  try {
    const { data } = await admin
      .from("operators")
      .select("id, email")
      .in("email", senderEmails);
    for (const r of (data ?? []) as { id: string; email: string }[]) {
      idByEmail.set(r.email, r.id);
    }
  } catch {
    // 이력 sender_operator_id는 null 허용 — 매핑 실패해도 발송 진행
  }

  // 버튼을 누른 admin (이력 triggered_by)
  let triggeredBy: string | null = null;
  try {
    const { data: opRow } = await admin
      .from("operators")
      .select("id")
      .eq("email", me.email)
      .maybeSingle();
    triggeredBy = (opRow as { id: string } | null)?.id ?? null;
  } catch {
    triggeredBy = null;
  }

  const itemResults: SendReminderItemResult[] = [];
  const insertRows: InsertRow[] = [];
  const sentRows: number[] = [];

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const uniqueCustomers = Array.from(
      new Set(group.items.map((it) => it.customerName).filter(Boolean)),
    );
    const base = {
      sent_at: new Date().toISOString(),
      sender_operator_id: idByEmail.get(group.sender.email) ?? null,
      triggered_by: triggeredBy,
      recipient_email: group.recipient.email,
      recipient_name: group.recipient.name ?? null,
      customer_names: uniqueCustomers,
      receivable_count: group.items.length,
      total_amount: group.totalAmount,
    };

    if (input.dryRun) {
      itemResults.push({
        recipientEmail: group.recipient.email,
        senderEmail: group.sender.email,
        status: "dry_run",
      });
      insertRows.push({
        ...base,
        graph_message_id: null,
        status: "dry_run",
        error_message: null,
      });
      continue;
    }

    const subject = buildReminderSubject({ group, companyName });
    const html = buildReminderHtml({
      group,
      senderName: group.sender.name,
      companyName,
    });
    const sendRes = await sendGraphMail({
      senderUserId: group.sender.email,
      toEmail: group.recipient.email,
      toName: group.recipient.name,
      subject,
      html,
    });

    if (sendRes.ok) {
      for (const it of group.items) {
        if (it.excelRow && it.excelRow > 0) sentRows.push(it.excelRow);
      }
      itemResults.push({
        recipientEmail: group.recipient.email,
        senderEmail: group.sender.email,
        status: "sent",
        graphMessageId: sendRes.messageId,
      });
      insertRows.push({
        ...base,
        graph_message_id: sendRes.messageId ?? null,
        status: "sent",
        error_message: null,
      });
    } else {
      itemResults.push({
        recipientEmail: group.recipient.email,
        senderEmail: group.sender.email,
        status: "failed",
        errorMessage: sendRes.error,
      });
      insertRows.push({
        ...base,
        graph_message_id: null,
        status: "failed",
        error_message: sendRes.error ?? null,
      });
    }

    // 1초 throttle (마지막 그룹 후 sleep 생략)
    if (i < groups.length - 1) {
      await sleep(1000);
    }
  }

  // 이력 일괄 insert — RLS 우회 (service_role)
  if (insertRows.length > 0) {
    await admin.from("receivables_mail_sends").insert(insertRows);
  }

  // 발송 성공 행에 '메일발송일자' 기록 — send 루프에서 모은 excelRow 사용(재조회 불필요).
  // PATCH 실패는 발송 결과에 영향 주지 않음(메일은 이미 나감) — 로그만.
  if (sentRows.length > 0) {
    const headerColIdx = findMailSentDateCol(sheet.headers);
    if (headerColIdx >= 0) {
      const res = await markReceivablesMailSent(
        sheet.worksheetName,
        sheet.validColIdx[headerColIdx],
        Array.from(new Set(sentRows)),
        todayKstYmd(),
      );
      if (!res.ok) {
        console.error("[receivables] 메일발송일자 기록 실패:", res.error);
      }
    }
  }

  revalidatePath("/dashboard/receivables");

  return {
    ok: true,
    sentCount: itemResults.filter((r) => r.status === "sent").length,
    failedCount: itemResults.filter((r) => r.status === "failed").length,
    dryRunCount: itemResults.filter((r) => r.status === "dry_run").length,
    blockedCount,
    results: itemResults,
  };
}
