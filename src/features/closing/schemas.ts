import { z } from "zod";

/**
 * closing(서비스 마감) 도메인 schemas.
 *
 * - closingRowSchema / closingIngestSchema: 인제스트 API(`POST /api/closing/ingest`)
 *   입력 검증. 스크래퍼가 KST(+09:00) 포함 ISO8601로 보내는 신뢰 경계.
 * - closingServicesRowSchema / ClosingRow: DB read 결과 형태.
 *
 * 운영자/개발자는 Moa 표기 문자열 그대로(email 매핑 안 함 — 11컬럼에 email 없음).
 */

export const closingRowSchema = z.object({
  service_id: z.number().int().positive(),
  university_name: z.string().min(1),
  region: z.string().nullable().optional(),
  service_name: z.string().min(1),
  university_type: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  admission_type: z.string().nullable().optional(), // 접수구분(수시/정시/추가 등)
  operator_name: z.string().nullable().optional(),
  developer_name: z.string().nullable().optional(),
  write_start_at: z.string().datetime({ offset: true }).nullable().optional(),
  write_end_at: z.string().datetime({ offset: true }),
  pay_start_at: z.string().datetime({ offset: true }).nullable().optional(), // 결제시작
  pay_end_at: z.string().datetime({ offset: true }).nullable().optional(), // 결제마감
  solo: z.boolean(),
});

export type ClosingIngestRow = z.infer<typeof closingRowSchema>;

export const closingIngestSchema = z.object({
  scraped_at: z.string().datetime({ offset: true }),
  rows: z.array(closingRowSchema).min(1), // 빈 배열 거부 — 전체 삭제 사고 방지
});

export type ClosingIngestPayload = z.infer<typeof closingIngestSchema>;

/**
 * DB read row (closing_services 테이블).
 * import 데이터 일관성을 위해 nullable 컬럼은 read 시 그대로 null 허용.
 */
export const closingServicesRowSchema = z.object({
  id: z.string().uuid(),
  service_id: z.number().int(),
  university_name: z.string(),
  region: z.string().nullable(),
  service_name: z.string(),
  university_type: z.string().nullable(),
  category: z.string().nullable(),
  admission_type: z.string().nullable(),
  operator_name: z.string().nullable(),
  developer_name: z.string().nullable(),
  write_start_at: z.string().nullable(),
  write_end_at: z.string(),
  pay_start_at: z.string().nullable(),
  pay_end_at: z.string().nullable(),
  solo: z.boolean(),
  scraped_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ClosingRow = z.infer<typeof closingServicesRowSchema>;
