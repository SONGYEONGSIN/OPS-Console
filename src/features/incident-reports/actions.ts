"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { resolveApprovalChain } from "./queries";
import { defaultApology } from "./apology";
import {
  incidentReportCreateSchema,
  incidentReportUpdateSchema,
  type IncidentReportRow,
} from "./schemas";

export type ReportActionResult =
  | { ok: true; row: IncidentReportRow }
  | { ok: false; error: string };

const AUTH_ERROR = "로그인이 필요합니다.";
const PATH = "/dashboard/incident-reports";

export async function createIncidentReport(
  input: unknown,
): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = incidentReportCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  let prefill = { ...parsed.data };

  if (parsed.data.incident_id) {
    const { data: inc } = await supabase
      .from("incidents")
      .select(
        "university_name,title,cause_summary,root_cause,resolution,prevention",
      )
      .eq("id", parsed.data.incident_id)
      .maybeSingle();
    if (inc) {
      prefill = {
        ...prefill,
        recipient_university: prefill.recipient_university || inc.university_name,
        title: prefill.title || inc.title,
        gyeongwi: prefill.gyeongwi ?? inc.cause_summary,
        cause: prefill.cause ?? inc.root_cause,
        handling: prefill.handling ?? inc.resolution,
        prevention: prefill.prevention ?? inc.prevention,
      };
    }
  }

  const chain = await resolveApprovalChain(me.email);

  const { data, error } = await supabase
    .from("incident_reports")
    .insert({
      incident_id: parsed.data.incident_id ?? null,
      recipient_university: prefill.recipient_university,
      title: prefill.title,
      gyeongwi: prefill.gyeongwi ?? null,
      cause: prefill.cause ?? null,
      handling: prefill.handling ?? null,
      prevention: prefill.prevention ?? null,
      apology:
        prefill.apology ?? defaultApology(prefill.recipient_university),
      author_name: me.displayName ?? me.email,
      author_email: me.email,
      approver_name: chain?.approver?.name ?? null,
      approver_email: chain?.approver?.email ?? null,
      director_name: chain?.director?.name ?? null,
      ceo_name: chain?.ceo?.name ?? null,
      status: "draft",
    })
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  await logActivity({
    domain: "incident-reports",
    action: "create",
    target_type: "incident_reports",
    target_id: data.id,
    target_name: data.title,
    msg: `경위서 생성 — ${data.recipient_university}`,
  });

  revalidatePath(PATH);
  return { ok: true, row: data as IncidentReportRow };
}

export async function updateIncidentReport(
  id: string,
  input: unknown,
): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const parsed = incidentReportUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "invalid" };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("incident_reports")
    .update({ ...parsed.data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };

  revalidatePath(PATH);
  return { ok: true, row: data as IncidentReportRow };
}

async function transition(
  id: string,
  from: string[],
  patch: Record<string, unknown>,
  errMsg: string,
): Promise<ReportActionResult> {
  const supabase = await createClient();
  const { data: cur } = await supabase
    .from("incident_reports")
    .select("status")
    .eq("id", id)
    .maybeSingle();
  if (!cur) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (!from.includes(cur.status)) return { ok: false, error: errMsg };

  const { data, error } = await supabase
    .from("incident_reports")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) return { ok: false, error: error.message };
  return { ok: true, row: data as IncidentReportRow };
}

export async function submitForApproval(
  id: string,
): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { data: rep } = await supabase
    .from("incident_reports")
    .select("author_email")
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.author_email !== me.email && me.permission !== "admin") {
    return { ok: false, error: "제출 권한이 없습니다." };
  }

  const r = await transition(
    id,
    ["draft", "rejected"],
    { status: "pending_approval", reject_reason: null },
    "제출할 수 없는 상태입니다.",
  );
  if (r.ok) {
    await logActivity({
      domain: "incident-reports",
      action: "submit",
      target_type: "incident_reports",
      target_id: id,
      target_name: r.row.title,
      msg: "승인 요청",
    });
    revalidatePath(PATH);
  }
  return r;
}

export async function approveIncidentReport(
  id: string,
): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { data: rep } = await supabase
    .from("incident_reports")
    .select("status,approver_email,title")
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email) {
    return { ok: false, error: "승인 권한이 없습니다." };
  }

  const r = await transition(
    id,
    ["pending_approval"],
    { status: "approved", approved_at: new Date().toISOString() },
    "승인할 수 없는 상태입니다.",
  );
  if (r.ok) {
    await logActivity({
      domain: "incident-reports",
      action: "approve",
      target_type: "incident_reports",
      target_id: id,
      target_name: rep.title,
      msg: "팀장 승인",
    });
    revalidatePath(PATH);
  }
  return r;
}

export async function rejectIncidentReport(
  id: string,
  reason: string,
): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { data: rep } = await supabase
    .from("incident_reports")
    .select("approver_email,title")
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email) {
    return { ok: false, error: "반려 권한이 없습니다." };
  }

  const r = await transition(
    id,
    ["pending_approval"],
    { status: "rejected", reject_reason: reason },
    "반려할 수 없는 상태입니다.",
  );
  if (r.ok) {
    await logActivity({
      domain: "incident-reports",
      action: "reject",
      target_type: "incident_reports",
      target_id: id,
      target_name: rep.title,
      level: "WARN",
      msg: `반려: ${reason}`,
    });
    revalidatePath(PATH);
  }
  return r;
}
