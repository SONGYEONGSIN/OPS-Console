import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { HandoverProgressStatus } from "./progress-schemas";
import type {
  ContractInfo,
  PaymentFee,
  PaymentInvoice,
  ContractChecklistItem,
  SchoolContact,
} from "./schemas";

export type ProgressListRow = {
  id: string;
  service_id: string;
  service_number: number | null;
  university_name: string;
  service_name: string;
  from_email: string;
  from_name: string;
  to_email: string;
  to_name: string;
  status: HandoverProgressStatus;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
};

type RawJoinRow = {
  id: string;
  service_id: string;
  from_email: string;
  from_name: string;
  to_email: string;
  to_name: string;
  status: HandoverProgressStatus;
  notes: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
  /** PostgREST: services는 FK 단일 객체 */
  services: {
    service_id: number;
    university_name: string;
    service_name: string;
  } | null;
};

/** 순수 매핑 — 테스트 가능 (services join 객체 → 평면 ProgressListRow) */
export function mapProgressJoinRow(r: RawJoinRow): ProgressListRow {
  return {
    id: r.id,
    service_id: r.service_id,
    service_number: r.services?.service_id ?? null,
    university_name: r.services?.university_name ?? "—",
    service_name: r.services?.service_name ?? "—",
    from_email: r.from_email,
    from_name: r.from_name,
    to_email: r.to_email,
    to_name: r.to_name,
    status: r.status,
    notes: r.notes ?? null,
    confirmed_at: r.confirmed_at ?? null,
    created_at: r.created_at,
  };
}

type ListInput = {
  q?: string;
  status?: HandoverProgressStatus;
  /** to_email = me */
  toEmail?: string;
  page?: number;
  pageSize?: number;
};

export async function listHandoverProgress(
  input: ListInput = {},
): Promise<{ rows: ProgressListRow[]; total: number }> {
  const supabase = await createClient();
  let q = supabase
    .from("handover_progress")
    .select(
      "id, service_id, from_email, from_name, to_email, to_name, status, notes, confirmed_at, created_at, updated_at, services(service_id, university_name, service_name)",
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (input.status) q = q.eq("status", input.status);
  if (input.toEmail) q = q.eq("to_email", input.toEmail);

  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? 30;
  q = q.range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await q;
  if (error) {
    console.error("[listHandoverProgress]", error);
    return { rows: [], total: 0 };
  }

  // supabase-js 추론은 services를 array로 보지만 FK to-one이라 객체 반환
  let rows = ((data ?? []) as unknown as RawJoinRow[]).map(mapProgressJoinRow);

  // 검색 (대학명/서비스명/인계자/인수자) — client-side (count는 DB-side)
  if (input.q) {
    const qq = input.q.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.university_name.toLowerCase().includes(qq) ||
        r.service_name.toLowerCase().includes(qq) ||
        r.from_name.toLowerCase().includes(qq) ||
        r.to_name.toLowerCase().includes(qq),
    );
  }

  return { rows, total: count ?? 0 };
}

export type ReadyService = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  /** services.category — 서비스 분류 (대학명 앞 표기용) */
  category: string;
  operator_name: string | null;
  /** handover_records.updated_at — 인수인계 내용 마지막 작성일 */
  updated_at: string;
  /** 14 sub-field — step3 미리보기용 */
  contract_info_md: string | null;
  contract_data_md: string | null;
  work_basic_md: string | null;
  work_generator_md: string | null;
  work_site_md: string | null;
  work_output_md: string | null;
  work_rate_md: string | null;
  work_file_md: string | null;
  work_etc_md: string | null;
  payment_fee_md: string | null;
  payment_invoice_md: string | null;
  school_contact_md: string | null;
  docs_md: string | null;
  notes_md: string | null;
  /** 구조화 필드 — 계약정보/정산/컨텍/체크리스트 미리보기용 */
  contract_info: ContractInfo | null;
  contract_data_checklist: ContractChecklistItem[];
  payment_fee: PaymentFee | null;
  payment_invoice: PaymentInvoice | null;
  school_contacts: SchoolContact[];
  docs_checklist: ContractChecklistItem[];
};

/** wizard step1 후보 — handover_records.status='ready' + 14 sub-field 포함.
 *  ownerEmail 지정 시 services.operator_email OR developer_email = ownerEmail 필터(클라이언트 측). */
export async function listReadyServices(
  ownerEmail?: string,
): Promise<ReadyService[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_records")
    .select(
      "service_id, updated_at, contract_info_md, contract_data_md, work_basic_md, work_generator_md, work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, payment_invoice_md, school_contact_md, docs_md, notes_md, contract_info, contract_data_checklist, payment_fee, payment_invoice, school_contacts, docs_checklist, services(id, service_id, university_name, service_name, application_type, category, operator_name, operator_email, developer_email)",
    )
    .eq("status", "ready")
    .limit(1000);
  if (error) {
    console.error("[listReadyServices]", error);
    return [];
  }
  type RawReady = {
    service_id: string;
    updated_at: string;
    contract_info_md: string | null;
    contract_data_md: string | null;
    work_basic_md: string | null;
    work_generator_md: string | null;
    work_site_md: string | null;
    work_output_md: string | null;
    work_rate_md: string | null;
    work_file_md: string | null;
    work_etc_md: string | null;
    payment_fee_md: string | null;
    payment_invoice_md: string | null;
    school_contact_md: string | null;
    docs_md: string | null;
    notes_md: string | null;
    contract_info: ContractInfo | null;
    contract_data_checklist: ContractChecklistItem[] | null;
    payment_fee: PaymentFee | null;
    payment_invoice: PaymentInvoice | null;
    school_contacts: SchoolContact[] | null;
    docs_checklist: ContractChecklistItem[] | null;
    services: {
      id: string;
      service_id: number;
      university_name: string;
      service_name: string;
      application_type: string;
      category: string;
      operator_name: string | null;
      operator_email: string | null;
      developer_email: string | null;
    } | null;
  };
  return ((data ?? []) as unknown as RawReady[])
    .filter((r) => r.services !== null)
    .filter((r) =>
      ownerEmail
        ? r.services!.operator_email === ownerEmail ||
          r.services!.developer_email === ownerEmail
        : true,
    )
    .map((r) => ({
      id: r.services!.id,
      service_id: r.services!.service_id,
      university_name: r.services!.university_name,
      service_name: r.services!.service_name,
      application_type: r.services!.application_type,
      category: r.services!.category,
      operator_name: r.services!.operator_name,
      updated_at: r.updated_at,
      contract_info_md: r.contract_info_md,
      contract_data_md: r.contract_data_md,
      work_basic_md: r.work_basic_md,
      work_generator_md: r.work_generator_md,
      work_site_md: r.work_site_md,
      work_output_md: r.work_output_md,
      work_rate_md: r.work_rate_md,
      work_file_md: r.work_file_md,
      work_etc_md: r.work_etc_md,
      payment_fee_md: r.payment_fee_md,
      payment_invoice_md: r.payment_invoice_md,
      school_contact_md: r.school_contact_md,
      docs_md: r.docs_md,
      notes_md: r.notes_md,
      contract_info: r.contract_info,
      contract_data_checklist: r.contract_data_checklist ?? [],
      payment_fee: r.payment_fee,
      payment_invoice: r.payment_invoice,
      school_contacts: r.school_contacts ?? [],
      docs_checklist: r.docs_checklist ?? [],
    }));
}
