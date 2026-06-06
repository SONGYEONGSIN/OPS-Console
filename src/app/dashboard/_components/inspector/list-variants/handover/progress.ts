import type { ListRow } from "../../../patterns/ListPattern";
import {
  HANDOVER_CATEGORIES,
  type HandoverCategoryKey,
  type HandoverFieldKey,
} from "@/features/handover/categories";

/** 필드 키 → ListRow의 handover* 키 매핑 (EditForm/View 공용 단일 정의) */
export const ROW_TO_FIELD: Record<HandoverFieldKey, keyof ListRow> = {
  contract_info_md: "handoverContractInfoMd",
  contract_data_md: "handoverContractDataMd",
  work_basic_md: "handoverWorkBasicMd",
  work_generator_md: "handoverWorkGeneratorMd",
  work_site_md: "handoverWorkSiteMd",
  work_output_md: "handoverWorkOutputMd",
  work_rate_md: "handoverWorkRateMd",
  work_file_md: "handoverWorkFileMd",
  work_etc_md: "handoverWorkEtcMd",
  payment_fee_md: "handoverPaymentFeeMd",
  payment_invoice_md: "handoverPaymentInvoiceMd",
  school_contact_md: "handoverSchoolContactMd",
  docs_md: "handoverDocsMd",
  notes_md: "handoverNotesMd",
};

/** 해당 필드가 작성되었는지 — 구조화 필드(폼/체크리스트/리스트)는 내용 유무로 판단. */
export function isFieldFilled(row: ListRow, key: HandoverFieldKey): boolean {
  if (key === "contract_info_md") {
    const ci = row.handoverContractInfo;
    return (
      !!ci &&
      [ci.title, ci.type, ci.progress, ci.status, ci.memo].some(
        (v) => v?.trim(),
      )
    );
  }
  if (key === "contract_data_md") {
    return (
      (row.handoverContractChecklist ?? []).some((c) => c.text.trim()) ||
      !!row.handoverContractDataMd?.trim()
    );
  }
  if (key === "docs_md") {
    return (
      (row.handoverDocsChecklist ?? []).some((c) => c.text.trim()) ||
      !!row.handoverDocsMd?.trim()
    );
  }
  if (key === "school_contact_md") {
    return (row.handoverSchoolContacts ?? []).length > 0;
  }
  const v = row[ROW_TO_FIELD[key]];
  return typeof v === "string" && v.trim().length > 0;
}

/** 카테고리의 작성 진행도 — {채운 필드 수, 전체 필드 수}. */
export function categoryProgress(
  row: ListRow,
  catKey: HandoverCategoryKey,
): { filled: number; total: number } {
  const cat = HANDOVER_CATEGORIES.find((c) => c.key === catKey);
  if (!cat) return { filled: 0, total: 0 };
  return {
    filled: cat.fields.filter((f) => isFieldFilled(row, f.key)).length,
    total: cat.fields.length,
  };
}
