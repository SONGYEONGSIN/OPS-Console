import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { IncidentReportRow, ReportStatus } from "./schemas";

export type OperatorLite = {
  email: string;
  name: string;
  team: string | null;
  role: string;
  leader: string | null;
};
export type ApprovalChain = {
  author: { name: string; email: string };
  approver: { name: string; email: string } | null;
  director: { name: string } | null;
  ceo: { name: string } | null;
};

export function pickApprovalChain(author: OperatorLite, all: OperatorLite[]): ApprovalChain {
  const byLeaderName = author.leader ? (all.find((o) => o.name === author.leader) ?? null) : null;
  const teamLead =
    byLeaderName ?? all.find((o) => o.team === author.team && o.role === "팀장") ?? null;
  const director = all.find((o) => o.role === "본부장") ?? null;
  const ceo = all.find((o) => o.role === "사장") ?? null;
  return {
    author: { name: author.name, email: author.email },
    approver: teamLead ? { name: teamLead.name, email: teamLead.email } : null,
    director: director ? { name: director.name } : null,
    ceo: ceo ? { name: ceo.name } : null,
  };
}

export async function resolveApprovalChain(authorEmail: string): Promise<ApprovalChain | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("operators")
    .select("email,name,team,role,leader")
    .in("status", ["active", "inactive"]);
  if (!data) return null;
  const author = data.find((o) => o.email === authorEmail);
  if (!author) return null;
  return pickApprovalChain(author as OperatorLite, data as OperatorLite[]);
}

export async function listRecipientCandidates(university: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("contacts")
    .select("customer_name,job_title,contact_email")
    .eq("university_name", university)
    .not("contact_email", "is", null);
  return (data ?? []).filter((c) => !!c.contact_email);
}

export async function listIncidentReports() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("*")
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function getIncidentReport(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function getIncidentReportByIncidentId(
  incidentId: string,
): Promise<IncidentReportRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("*")
    .eq("incident_id", incidentId)
    .maybeSingle();
  return (data as IncidentReportRow | null) ?? null;
}

/** 순수 헬퍼: incident_id → status 맵 빌드 (null incident_id 제외). */
export function buildReportStatusMap(
  rows: { incident_id: string | null; status: ReportStatus }[],
): Record<string, ReportStatus> {
  const map: Record<string, ReportStatus> = {};
  for (const r of rows) {
    if (r.incident_id) map[r.incident_id] = r.status;
  }
  return map;
}

/** 목록 배지용 batch 조회 — N+1 회피. 빈 입력 → {}. */
export async function reportStatusByIncidentIds(
  incidentIds: string[],
): Promise<Record<string, ReportStatus>> {
  if (incidentIds.length === 0) return {};
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("incident_id,status")
    .in("incident_id", incidentIds);
  return buildReportStatusMap(
    (data ?? []) as { incident_id: string | null; status: ReportStatus }[],
  );
}
