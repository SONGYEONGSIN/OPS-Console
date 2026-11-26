import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSalesTeam } from "@/features/auth/operators";
import type { IncidentReportRow, ReportStatus } from "./schemas";

export type OperatorLite = {
  email: string;
  name: string;
  team: string | null;
  role: string;
  leader: string | null;
  phone?: string | null;
  /** 사번 — 같은 자격의 후보가 여럿일 때 고정 정렬 키(DB 반환 순서에 기대지 않는다). */
  emp_no?: string | null;
};
/**
 * 경위서 결재라인 — 담당자 → 팀장 → 부장 → 본부장 4칸.
 * 저장 칼럼 이름이 칸 이름과 다르다(마이그레이션 없이 재사용):
 * `approver_*` = 팀장(승인자), `director_*` = **부장**, `ceo_*` = **본부장**.
 */
export type ApprovalChain = {
  author: { name: string; email: string; phone: string | null };
  /** 팀장 — 승인자. 운영1팀처럼 팀장이 없으면 같은 팀 부장이 겸임한다. */
  approver: { name: string; email: string; role: string } | null;
  /** 부장 (저장 칼럼 director_*) */
  director: { name: string; role: string } | null;
  /** 본부장 (저장 칼럼 ceo_*) — 영업팀 밖 role 이사. */
  ceo: { name: string; role: string } | null;
};

function byEmpNo(a: OperatorLite, b: OperatorLite): number {
  return (
    (a.emp_no ?? "").localeCompare(b.emp_no ?? "") ||
    a.email.localeCompare(b.email)
  );
}

/**
 * 기준 인물(사고 담당자) 기준 결재라인.
 * - 팀장: leader 이름 → 같은 팀 팀장 → 같은 팀 부장(겸임)
 * - 부장: 같은 팀 부장 → 부장
 * - 본부장: 이사 (사고보고 메일 이사님 참조 `incidents/cc.ts` 와 같은 조건)
 */
export function pickApprovalChain(duty: OperatorLite, everyone: OperatorLite[]): ApprovalChain {
  // 영업팀은 사고보고 메일 참조용으로만 등재돼 결재선에 들지 않는다.
  const all = everyone.filter((o) => !isSalesTeam(o.team)).sort(byEmpNo);
  const sameTeam = (role: string) =>
    all.find((o) => o.team === duty.team && o.role === role);
  const byLeaderName = duty.leader ? all.find((o) => o.name === duty.leader) : undefined;
  const teamLead = byLeaderName ?? sameTeam("팀장") ?? sameTeam("부장") ?? null;
  const director = sameTeam("부장") ?? all.find((o) => o.role === "부장") ?? null;
  const ceo = all.find((o) => o.role === "이사") ?? null;
  return {
    author: { name: duty.name, email: duty.email, phone: duty.phone ?? null },
    approver: teamLead
      ? { name: teamLead.name, email: teamLead.email, role: teamLead.role }
      : null,
    director: director ? { name: director.name, role: director.role } : null,
    ceo: ceo ? { name: ceo.name, role: ceo.role } : null,
  };
}

export async function resolveApprovalChain(dutyEmail: string): Promise<ApprovalChain | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("operators")
    .select("email,name,team,role,leader,phone,emp_no")
    .in("status", ["active", "inactive"]);
  if (!data) return null;
  const duty = data.find((o) => o.email === dutyEmail);
  if (!duty) return null;
  return pickApprovalChain(duty as OperatorLite, data as OperatorLite[]);
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

/**
 * 팀장 결재 큐 — 본인이 승인자인 `pending_approval` 경위서의 incident_id 목록.
 * 경위서 메뉴 제거 후 사고보고 목록의 `승인 대기` 칩 필터 소스. 빈 email → [].
 */
export async function incidentIdsWithPendingApprovalFor(
  approverEmail: string,
): Promise<string[]> {
  if (!approverEmail) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("incident_id")
    .eq("status", "pending_approval")
    .eq("approver_email", approverEmail);
  const rows = (data ?? []) as { incident_id: string | null }[];
  return rows
    .map((r) => r.incident_id)
    .filter((id): id is string => id != null);
}

/** 승인완료(approved) 경위서가 달린 사고 id 목록. */
export async function incidentIdsWithApprovedReports(): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("incident_reports")
    .select("incident_id")
    .eq("status", "approved");
  const rows = (data ?? []) as { incident_id: string | null }[];
  return rows
    .map((r) => r.incident_id)
    .filter((id): id is string => id != null);
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
