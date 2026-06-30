import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  handoverRecordRowSchema,
  type HandoverRecordRow,
  type HandoverStatus,
  type ContractChecklistItem,
  type SchoolContact,
  type ContractInfo,
  type PaymentFee,
  type PaymentInvoice,
} from "./schemas";

const EMPTY_PAYMENT_FEE: PaymentFee = { deadline: "", manager: "", memo: "" };
const EMPTY_PAYMENT_INVOICE: PaymentInvoice = { issueType: "", memo: "" };

const EMPTY_CONTRACT_INFO: ContractInfo = {
  title: "",
  type: "",
  progress: "",
  status: "",
  memo: "",
};

export type ListInput = {
  q?: string;
  /** 'none' = handover_records 없음 (미작성). 그 외는 status enum */
  status?: HandoverStatus | "none";
  /** 본인 운영/개발 서비스만 (services 패턴 mirror — operator_email OR developer_email) */
  ownerEmail?: string;
  page?: number;
  pageSize?: number;
};

const DEFAULT_PAGE_SIZE = 30;

export type HandoverListRow = {
  service_id: string;
  service_number: number;
  university_name: string;
  service_name: string;
  application_type: string;
  university_type: string;
  operator_name: string | null;
  handover_status: HandoverStatus | null;
  /** 14 sub-field — 인스펙터 EditForm 초기값 (record 없으면 모두 null) */
  contract_info_md: string | null;
  contract_info: ContractInfo;
  contract_data_md: string | null;
  contract_data_checklist: ContractChecklistItem[];
  work_basic_md: string | null;
  work_generator_md: string | null;
  work_site_md: string | null;
  work_output_md: string | null;
  work_rate_md: string | null;
  work_file_md: string | null;
  work_etc_md: string | null;
  payment_fee_md: string | null;
  payment_invoice_md: string | null;
  payment_fee: PaymentFee;
  payment_invoice: PaymentInvoice;
  school_contact_md: string | null;
  school_contacts: SchoolContact[];
  docs_md: string | null;
  docs_checklist: ContractChecklistItem[];
  notes_md: string | null;
};

type HandoverEmbed = {
  status: HandoverStatus;
  contract_info_md: string | null;
  contract_info: ContractInfo | null;
  contract_data_md: string | null;
  contract_data_checklist: ContractChecklistItem[] | null;
  work_basic_md: string | null;
  work_generator_md: string | null;
  work_site_md: string | null;
  work_output_md: string | null;
  work_rate_md: string | null;
  work_file_md: string | null;
  work_etc_md: string | null;
  payment_fee_md: string | null;
  payment_invoice_md: string | null;
  payment_fee: PaymentFee | null;
  payment_invoice: PaymentInvoice | null;
  school_contact_md: string | null;
  school_contacts: SchoolContact[] | null;
  docs_md: string | null;
  docs_checklist: ContractChecklistItem[] | null;
  notes_md: string | null;
};

type RawJoinRow = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  university_type: string;
  operator_name: string | null;
  /** PostgREST는 service_id unique 제약 때문에 단일 객체 반환 (배열 아님) */
  handover_records: HandoverEmbed | null;
};

/**
 * services left join handover_records. 작성 상태(handover_status) 포함.
 * status='none'은 handover_records가 없는(=한 번도 작성 안 한) row 필터.
 */
export async function listServicesWithHandover(
  input: ListInput = {},
): Promise<{ rows: HandoverListRow[]; total: number }> {
  const supabase = await createClient();
  const page = Math.max(1, input.page ?? 1);
  const pageSize = input.pageSize ?? DEFAULT_PAGE_SIZE;
  const usingStatusFilter = !!input.status;

  let q = supabase
    .from("services")
    .select(
      "id, service_id, university_name, service_name, application_type, university_type, operator_name, handover_records(status, contract_info_md, contract_info, contract_data_md, contract_data_checklist, work_basic_md, work_generator_md, work_site_md, work_output_md, work_rate_md, work_file_md, work_etc_md, payment_fee_md, payment_invoice_md, payment_fee, payment_invoice, school_contact_md, school_contacts, docs_md, docs_checklist, notes_md)",
      { count: "exact" },
    )
    .order("service_id", { ascending: true });

  if (input.q) {
    const like = `%${input.q}%`;
    q = q.or(`university_name.ilike.${like},service_name.ilike.${like}`);
  }

  if (input.ownerEmail) {
    q = q.or(
      `operator_email.eq.${input.ownerEmail},developer_email.eq.${input.ownerEmail}`,
    );
  }

  // status 필터 시 DB-side 페이지네이션이 부정확(현재 페이지의 30건만 client filter)
  // → fetch all 후 client filter + slice. 그 외는 DB-side 페이지네이션 유지.
  if (usingStatusFilter) {
    q = q.range(0, 9999);
  } else {
    q = q.range((page - 1) * pageSize, page * pageSize - 1);
  }

  const { data, error, count } = await q;
  if (error) {
    console.error("[listServicesWithHandover]", error);
    return { rows: [], total: 0 };
  }

  // supabase-js 추론 타입은 handover_records를 배열로 보지만, service_id unique
  // 제약 때문에 PostgREST는 실제로 단일 객체를 반환한다. unknown 경유 캐스트.
  const rows: HandoverListRow[] = ((data ?? []) as unknown as RawJoinRow[]).map(
    (r) => {
      const rec = r.handover_records ?? null;
      return {
      service_id: r.id,
      service_number: r.service_id,
      university_name: r.university_name,
      service_name: r.service_name,
      application_type: r.application_type,
      university_type: r.university_type,
      operator_name: r.operator_name,
        handover_status: rec?.status ?? null,
        contract_info_md: rec?.contract_info_md ?? null,
        contract_info: rec?.contract_info ?? EMPTY_CONTRACT_INFO,
        contract_data_md: rec?.contract_data_md ?? null,
        contract_data_checklist: rec?.contract_data_checklist ?? [],
        work_basic_md: rec?.work_basic_md ?? null,
        work_generator_md: rec?.work_generator_md ?? null,
        work_site_md: rec?.work_site_md ?? null,
        work_output_md: rec?.work_output_md ?? null,
        work_rate_md: rec?.work_rate_md ?? null,
        work_file_md: rec?.work_file_md ?? null,
        work_etc_md: rec?.work_etc_md ?? null,
        payment_fee_md: rec?.payment_fee_md ?? null,
        payment_invoice_md: rec?.payment_invoice_md ?? null,
        payment_fee: rec?.payment_fee ?? EMPTY_PAYMENT_FEE,
        payment_invoice: rec?.payment_invoice ?? EMPTY_PAYMENT_INVOICE,
        school_contact_md: rec?.school_contact_md ?? null,
        school_contacts: rec?.school_contacts ?? [],
        docs_md: rec?.docs_md ?? null,
        docs_checklist: rec?.docs_checklist ?? [],
        notes_md: rec?.notes_md ?? null,
      };
    },
  );

  if (usingStatusFilter) {
    const filtered = rows.filter((r) =>
      input.status === "none"
        ? r.handover_status === null
        : r.handover_status === input.status,
    );
    const total = filtered.length;
    const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { rows: paged, total };
  }

  return { rows, total: count ?? 0 };
}

export type ServiceLite = {
  id: string;
  service_id: number;
  university_name: string;
  service_name: string;
  application_type: string;
  operator_name: string | null;
};

/**
 * services 단건 fetch — handover detail page 헤더용 (대학명·서비스명·운영자 등).
 */
export async function getServiceForHandover(
  serviceId: string,
): Promise<ServiceLite | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("services")
    .select(
      "id, service_id, university_name, service_name, application_type, operator_name",
    )
    .eq("id", serviceId)
    .maybeSingle();
  if (error || !data) return null;
  return data as ServiceLite;
}

export async function getHandoverByServiceId(
  serviceId: string,
): Promise<HandoverRecordRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handover_records")
    .select("*")
    .eq("service_id", serviceId)
    .maybeSingle();
  if (error) {
    console.error("[getHandoverByServiceId]", error);
    return null;
  }
  if (!data) return null;
  const r = handoverRecordRowSchema.safeParse(data);
  if (!r.success) {
    console.error("[getHandoverByServiceId] zod fail:", r.error.issues);
    return null;
  }
  return r.data;
}

export type HandoverContactCandidate = {
  universityName: string;
  name: string;
  jobTitle: string | null;
  phone: string | null;
  ext: string | null;
  email: string | null;
};

/**
 * 대학별 연락처 후보 — 컨텍(학교담당자) 검색·등록용. contacts 마스터에서 조회.
 * 빈 입력이면 빈 배열.
 */
export async function getHandoverContactCandidates(
  universityNames: string[],
): Promise<HandoverContactCandidate[]> {
  const unique = [...new Set(universityNames.filter(Boolean))];
  if (unique.length === 0) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .select(
      "university_name, customer_name, job_title, contact_phone, contact_ext, contact_email",
    )
    .in("university_name", unique)
    .order("customer_name", { ascending: true });
  if (error) {
    console.error("[getHandoverContactCandidates]", error);
    return [];
  }
  return (data ?? []).map((c) => ({
    universityName: c.university_name as string,
    name: c.customer_name as string,
    jobTitle: (c.job_title as string | null) ?? null,
    phone: (c.contact_phone as string | null) ?? null,
    ext: (c.contact_ext as string | null) ?? null,
    email: (c.contact_email as string | null) ?? null,
  }));
}
