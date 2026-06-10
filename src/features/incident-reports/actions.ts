"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOperator } from "@/features/auth/queries";
import { logActivity } from "@/features/worklog/log";
import { resolveApprovalChain } from "./queries";
import { defaultApology } from "./apology";
import { assignDocNumber, type RegisterInput } from "./sharepoint-register";
import { getIncidentById } from "@/features/incidents/queries";
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
        recipient_university:
          prefill.recipient_university || inc.university_name,
        title: prefill.title || inc.title,
        gyeongwi: prefill.gyeongwi ?? inc.cause_summary,
        cause: prefill.cause ?? inc.root_cause,
        handling: prefill.handling ?? inc.resolution,
        prevention: prefill.prevention ?? inc.prevention,
      };
    }
  }

  // 수신대학·제목은 입력 또는 사고에서 채워져야 함. 사고 미발견 등으로 비면 차단
  // (DB NOT NULL 위반 방지).
  if (!prefill.recipient_university || !prefill.title) {
    return { ok: false, error: "연결된 사고 정보를 불러올 수 없습니다." };
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
      apology: prefill.apology ?? defaultApology(prefill.recipient_university),
      author_name: me.displayName ?? me.email,
      author_email: me.email,
      approver_name: chain?.approver?.name ?? null,
      approver_email: chain?.approver?.email ?? null,
      approver_role: chain?.approver?.role ?? null,
      director_name: chain?.director?.name ?? null,
      director_role: chain?.director?.role ?? null,
      ceo_name: chain?.ceo?.name ?? null,
      ceo_role: chain?.ceo?.role ?? null,
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
    .select("status,approver_email,title,incident_id")
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email) {
    return { ok: false, error: "승인 권한이 없습니다." };
  }

  // 승인 시 동결 — 연결 사고의 공유 필드를 경위서 스냅샷 컬럼으로 복사한다.
  // 이후 사고를 수정해도 승인된 경위서는 불변(스냅샷 표시).
  let snapshot: Record<string, unknown> = {};
  if (rep.incident_id) {
    const { data: inc } = await supabase
      .from("incidents")
      .select(
        "university_name,service_name,title,cause_summary,root_cause,handling_rows,resolution,prevention",
      )
      .eq("id", rep.incident_id)
      .maybeSingle();
    if (inc) {
      snapshot = {
        recipient_university: inc.university_name,
        service_name: inc.service_name,
        title: inc.title,
        gyeongwi: inc.cause_summary,
        cause: inc.root_cause,
        handling: inc.resolution,
        handling_rows: inc.handling_rows ?? [],
        prevention: inc.prevention,
      };
    }
  }

  const r = await transition(
    id,
    ["pending_approval"],
    { status: "approved", approved_at: new Date().toISOString(), ...snapshot },
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

/**
 * 승인 취소 — 승인완료(approved) 경위서를 작성중(draft)으로 되돌린다.
 * 승인자 본인 또는 admin만. 발송완료(sent)는 취소 불가(approved에서만 전이).
 */
export async function revokeApproval(id: string): Promise<ReportActionResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const supabase = await createClient();
  const { data: rep } = await supabase
    .from("incident_reports")
    .select("approver_email,title")
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };
  if (rep.approver_email !== me.email && me.permission !== "admin") {
    return { ok: false, error: "승인 취소 권한이 없습니다." };
  }

  const r = await transition(
    id,
    ["approved"],
    { status: "draft", approved_at: null },
    "승인 취소할 수 없는 상태입니다.",
  );
  if (r.ok) {
    await logActivity({
      domain: "incident-reports",
      action: "revoke",
      target_type: "incident_reports",
      target_id: id,
      target_name: rep.title,
      level: "WARN",
      msg: "승인 취소",
    });
    revalidatePath(PATH);
  }
  return r;
}

export type IssueDocNumberResult =
  | { ok: true; docNumber: string | null }
  | { ok: false; error: string };

/**
 * 발번 — PDF 버튼 클릭 시점에 1회 호출. 승인완료(approved) + 미발번일 때만 채번한다.
 * 이미 doc_number 있으면 재사용(멱등), approved 아니면 no-op(docNumber:null).
 * 채번 = 시행번호 + 공문관리대장 행기록(F=파일링크 빈칸). 파일 업로드는 발송 시점.
 */
export async function issueIncidentReportDocNumber(
  id: string,
): Promise<IssueDocNumberResult> {
  const me = await getCurrentOperator();
  if (!me) return { ok: false, error: AUTH_ERROR };

  const admin = createAdminClient();
  const { data: rep } = await admin
    .from("incident_reports")
    .select(
      "id,status,doc_number,recipient_university,title,author_name,author_email,draft_date,approver_name,approver_role,director_name,director_role,ceo_name,ceo_role,apology,gyeongwi,cause,handling,handling_rows,prevention,incident_id",
    )
    .eq("id", id)
    .maybeSingle();
  if (!rep) return { ok: false, error: "경위서를 찾을 수 없습니다." };

  if (rep.doc_number) return { ok: true, docNumber: rep.doc_number };
  // approved 또는 sent(번호 없이 발송된 과거 건 복구)일 때만 채번. draft/pending/rejected는 no-op.
  if (rep.status !== "approved" && rep.status !== "sent")
    return { ok: true, docNumber: null };

  // 대장 작성자 = 사고보고 담당자(사고 assignee). 없으면 리포트 작성자 폴백.
  const incident = rep.incident_id
    ? await getIncidentById(rep.incident_id).catch(() => null)
    : null;
  const assigned = await assignDocNumber(rep as RegisterInput, new Date(), {
    ledgerAuthor: incident?.assignee_name ?? rep.author_name,
  });
  if (!assigned) return { ok: true, docNumber: null };

  await admin
    .from("incident_reports")
    .update({ doc_number: assigned.docNumber })
    .eq("id", id);

  revalidatePath(PATH);
  return { ok: true, docNumber: assigned.docNumber };
}
