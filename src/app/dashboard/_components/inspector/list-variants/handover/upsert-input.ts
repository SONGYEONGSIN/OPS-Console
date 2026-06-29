import type { ListRow } from "../../../patterns/ListPattern";
import type { HandoverRecordUpsert } from "@/features/handover/schemas";

/**
 * ListRow → handover_records upsert 입력. service_id는 row.id.
 * 빈 체크리스트/연락처 항목은 제외, 구조화 필드는 없으면 기본값.
 * 인스펙터 저장(page.tsx onPersist)과 풀스크린 편집기 자동저장이 공유한다.
 */
export function buildHandoverUpsertInput(row: ListRow): HandoverRecordUpsert {
  return {
    service_id: row.id,
    contract_info_md: row.handoverContractInfoMd ?? null,
    contract_info: row.handoverContractInfo ?? {
      title: "",
      type: "",
      progress: "",
      status: "",
      memo: "",
    },
    contract_data_md: row.handoverContractDataMd ?? null,
    contract_data_checklist: (row.handoverContractChecklist ?? []).filter((c) =>
      c.text.trim(),
    ),
    work_basic_md: row.handoverWorkBasicMd ?? null,
    work_generator_md: row.handoverWorkGeneratorMd ?? null,
    work_site_md: row.handoverWorkSiteMd ?? null,
    work_output_md: row.handoverWorkOutputMd ?? null,
    work_rate_md: row.handoverWorkRateMd ?? null,
    work_file_md: row.handoverWorkFileMd ?? null,
    work_etc_md: row.handoverWorkEtcMd ?? null,
    payment_fee_md: row.handoverPaymentFeeMd ?? null,
    payment_invoice_md: row.handoverPaymentInvoiceMd ?? null,
    payment_fee: row.handoverPaymentFee ?? {
      deadline: "",
      manager: "",
      memo: "",
    },
    payment_invoice: row.handoverPaymentInvoice ?? {
      issueType: "",
      memo: "",
    },
    school_contact_md: row.handoverSchoolContactMd ?? null,
    school_contacts: (row.handoverSchoolContacts ?? []).filter((c) =>
      c.name.trim(),
    ),
    docs_md: row.handoverDocsMd ?? null,
    docs_checklist: (row.handoverDocsChecklist ?? []).filter((c) =>
      c.text.trim(),
    ),
    notes_md: row.handoverNotesMd ?? null,
  };
}
