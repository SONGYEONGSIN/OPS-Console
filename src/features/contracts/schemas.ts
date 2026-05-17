import { z } from "zod";

/**
 * contracts 도메인 schemas (read-only view).
 *
 * SharePoint 계약서 Excel(`SHAREPOINT_CONTRACTS_ITEM_ID`)의 5 시트를
 * 통합 노출. 등록·수정·삭제 없음 — 입력 schema 불필요.
 *
 * 시트별 컬럼이 다르므로 *공통 최소 컬럼*만 평탄화 + 시트별 전체 컬럼은
 * `raw: Record<header, value>` 에 저장하여 인스펙터 view에서 노출.
 */

export const contractSheetEnum = z.enum([
  "4년제",
  "전문대",
  "초중고",
  "대학원",
  "기타",
]);

export type ContractSheet = z.infer<typeof contractSheetEnum>;

/** 노출 대상 5 시트 — 진학프로/요약/통합DB 연동용 제외 (T1 분석 결과) */
export const CONTRACT_SHEETS = contractSheetEnum.options;

export const contractRowSchema = z.object({
  /** unique id: `${sheet}-${excelRowNumber}` */
  id: z.string(),
  sheet: contractSheetEnum,
  /** Excel 1-base row 번호 (PATCH 시 셀 주소 생성용) */
  excelRowNumber: z.number(),
  /** 넘버링 (예: D-1-01) — 시트별 prefix 포함 */
  numbering: z.string(),
  /** 대학명/학교명 — 시트별 컬럼명 다르나 동일 의미로 통합 */
  name: z.string(),
  /** 운영자 */
  operator: z.string(),
  /** 계약진행현황 (계약완료 / 공란) */
  status: z.string(),
  /** 서비스여부 (Y / 공란) */
  serviceActive: z.string(),
  /** 수수료(VAT포함) — Excel display text 그대로 */
  feeAmount: z.string(),
  /**
   * 4 핵심 필드의 Excel 셀 주소(A1). 헤더 미발견 시 null (해당 필드 편집 불가).
   * PATCH server action에서 사용.
   */
  cellAddress: z.object({
    operator: z.string().nullable(),
    status: z.string().nullable(),
    serviceActive: z.string().nullable(),
    feeAmount: z.string().nullable(),
  }),
  /** 시트별 전체 컬럼 (헤더 → 값) — 인스펙터 raw view */
  raw: z.record(z.string(), z.string()),
});

export type ContractRow = z.infer<typeof contractRowSchema>;

export const EDITABLE_FIELDS = [
  "operator",
  "status",
  "serviceActive",
  "feeAmount",
] as const;
export type ContractEditableField = (typeof EDITABLE_FIELDS)[number];

export const contractUpdateSchema = z.object({
  sheet: contractSheetEnum,
  cellAddress: z.string().regex(/^[A-Z]+\d+$/, "invalid cell address"),
  value: z.string().max(500),
});
export type ContractUpdateInput = z.infer<typeof contractUpdateSchema>;
