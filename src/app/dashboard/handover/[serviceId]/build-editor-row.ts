import type { ListRow } from "@/app/dashboard/_components/patterns/ListPattern";
import type { ServiceLite } from "@/features/handover/queries";
import type { HandoverRecordRow } from "@/features/handover/schemas";

type ContactCandidate = {
  name: string;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
};

const EMPTY_CONTRACT_INFO = {
  title: "",
  type: "",
  progress: "",
  status: "",
  memo: "",
};
const EMPTY_PAYMENT_FEE = { deadline: "", manager: "", memo: "" };
const EMPTY_PAYMENT_INVOICE = { issueType: "", memo: "" };

/** 서버 로드 데이터 → 풀스크린 편집기 클라이언트 상태(ListRow). */
export function buildEditorRow(
  service: ServiceLite,
  record: HandoverRecordRow | null,
  contacts: ContactCandidate[],
): ListRow {
  return {
    id: service.id,
    name: `${service.university_name} · ${service.service_name}`,
    status: "active",
    owner: service.operator_name ?? "—",
    universityName: service.university_name,
    serviceName: service.service_name,
    applicationType: service.application_type,
    handoverServiceNumber: service.service_id,
    handoverStatus: record?.status ?? undefined,
    handoverContractInfoMd: record?.contract_info_md ?? null,
    handoverContractInfo: record?.contract_info ?? EMPTY_CONTRACT_INFO,
    handoverContractDataMd: record?.contract_data_md ?? null,
    handoverContractChecklist: record?.contract_data_checklist ?? [],
    handoverWorkBasicMd: record?.work_basic_md ?? null,
    handoverWorkGeneratorMd: record?.work_generator_md ?? null,
    handoverWorkSiteMd: record?.work_site_md ?? null,
    handoverWorkOutputMd: record?.work_output_md ?? null,
    handoverWorkRateMd: record?.work_rate_md ?? null,
    handoverWorkFileMd: record?.work_file_md ?? null,
    handoverWorkEtcMd: record?.work_etc_md ?? null,
    handoverPaymentFeeMd: record?.payment_fee_md ?? null,
    handoverPaymentInvoiceMd: record?.payment_invoice_md ?? null,
    handoverPaymentFee: record?.payment_fee ?? EMPTY_PAYMENT_FEE,
    handoverPaymentInvoice: record?.payment_invoice ?? EMPTY_PAYMENT_INVOICE,
    handoverSchoolContactMd: record?.school_contact_md ?? null,
    handoverSchoolContacts: record?.school_contacts ?? [],
    handoverDocsMd: record?.docs_md ?? null,
    handoverDocsChecklist: record?.docs_checklist ?? [],
    handoverNotesMd: record?.notes_md ?? null,
    handoverSchoolContactCandidates: contacts.map((c) => ({
      name: c.name,
      jobTitle: c.jobTitle,
      phone: c.phone,
      email: c.email,
    })),
  };
}
