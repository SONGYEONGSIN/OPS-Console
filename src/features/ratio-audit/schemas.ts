import { z } from "zod";

/**
 * ratio-audit(경쟁률 세팅 점검) 인제스트 계약.
 *
 * 스크래퍼(scripts/moa-ratio/audit.py)가 보내는 결과의 신뢰 경계.
 * claude 판정 결과가 그대로 들어오므로 type/field는 열거형으로 좁혀
 * 프롬프트가 헛짚은 값이 DB에 남지 않게 한다.
 */

export const ratioFindingItemSchema = z.object({
  /** year: 문구의 날짜 연도가 스케줄 연도 집합에 없음 / schedule: 날짜·시각 불일치 */
  type: z.enum(["year", "schedule"]),
  /** 어느 문구에서 발견했는지 — 오픈전 내용 / 상단 내용 */
  field: z.enum(["pre_open", "top"]),
  found: z.string().min(1),
  expect: z.string().min(1),
  quote: z.string().default(""),
});

export const ratioFindingSchema = z.object({
  serviceId: z.number().int().positive(),
  universityName: z.string().min(1),
  serviceName: z.string().default(""),
  operatorName: z.string().default(""),
  // 이상이 없으면 finding 자체를 보내지 않는다(빈 items는 계약 위반).
  items: z.array(ratioFindingItemSchema).min(1),
});

export const ratioLinkErrorSchema = z.object({
  serviceId: z.number().int().positive(),
  url: z.string().url(),
  /** HTTP 상태코드. 요청 자체가 실패하면 0 */
  status: z.number().int(),
  reason: z.string().default(""),
});

export const ratioSkippedSchema = z.object({
  serviceId: z.number().int().positive(),
  reason: z.string().min(1),
});

export const ratioAuditIngestSchema = z.object({
  scannedCount: z.number().int().nonnegative(),
  findings: z.array(ratioFindingSchema),
  linkErrors: z.array(ratioLinkErrorSchema),
  skipped: z.array(ratioSkippedSchema),
});

export type RatioFindingItem = z.infer<typeof ratioFindingItemSchema>;
export type RatioFinding = z.infer<typeof ratioFindingSchema>;
export type RatioLinkError = z.infer<typeof ratioLinkErrorSchema>;
export type RatioSkipped = z.infer<typeof ratioSkippedSchema>;
export type RatioAuditIngest = z.infer<typeof ratioAuditIngestSchema>;
