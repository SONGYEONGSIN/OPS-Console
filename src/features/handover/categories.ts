/**
 * 인수인계 카테고리·필드 메타 — single source-of-truth.
 * UI(CategoryNav / HandoverForm) + 데이터 모델(schemas / actions)에서 모두 import.
 */

export type HandoverCategoryKey =
  | "contract"
  | "work"
  | "payment"
  | "contact"
  | "docs"
  | "etc";

export type HandoverFieldKey =
  | "contract_info_md"
  | "contract_data_md"
  | "work_basic_md"
  | "work_generator_md"
  | "work_site_md"
  | "work_output_md"
  | "work_rate_md"
  | "work_file_md"
  | "work_etc_md"
  | "payment_fee_md"
  | "payment_invoice_md"
  | "school_contact_md"
  | "docs_md"
  | "notes_md";

export type HandoverCategory = {
  readonly key: HandoverCategoryKey;
  readonly label: string;
  readonly fields: ReadonlyArray<{
    readonly key: HandoverFieldKey;
    readonly label: string;
  }>;
};

export const HANDOVER_CATEGORIES: ReadonlyArray<HandoverCategory> = [
  {
    key: "contract",
    label: "계약",
    fields: [
      { key: "contract_info_md", label: "계약정보" },
      { key: "contract_data_md", label: "계약자료" },
    ],
  },
  {
    key: "work",
    label: "작업",
    fields: [
      { key: "work_basic_md", label: "기초작업" },
      { key: "work_generator_md", label: "생성툴" },
      { key: "work_site_md", label: "사이트·페이지" },
      { key: "work_output_md", label: "출력물" },
      { key: "work_rate_md", label: "경쟁률" },
      { key: "work_file_md", label: "전산파일" },
      { key: "work_etc_md", label: "기타" },
    ],
  },
  {
    key: "payment",
    label: "정산",
    fields: [
      { key: "payment_fee_md", label: "전형료" },
      { key: "payment_invoice_md", label: "계산서" },
    ],
  },
  {
    key: "contact",
    label: "컨텍",
    fields: [{ key: "school_contact_md", label: "학교담당자" }],
  },
  {
    key: "docs",
    label: "서류",
    fields: [{ key: "docs_md", label: "서류제출" }],
  },
  {
    key: "etc",
    label: "기타",
    fields: [{ key: "notes_md", label: "특이사항" }],
  },
] as const;

/** 14 필드 키 평탄화 — 카테고리 순서대로 */
export const HANDOVER_FIELD_KEYS: ReadonlyArray<HandoverFieldKey> = [
  "contract_info_md",
  "contract_data_md",
  "work_basic_md",
  "work_generator_md",
  "work_site_md",
  "work_output_md",
  "work_rate_md",
  "work_file_md",
  "work_etc_md",
  "payment_fee_md",
  "payment_invoice_md",
  "school_contact_md",
  "docs_md",
  "notes_md",
] as const;
