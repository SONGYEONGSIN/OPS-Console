import { z } from "zod";

/**
 * ratio-audit(경쟁률 세팅 점검) 인제스트 계약.
 *
 * 스크래퍼(scripts/moa-ratio/audit.py)가 보내는 결과의 신뢰 경계.
 * claude 판정 결과가 그대로 들어오므로 type/field는 열거형으로 좁혀
 * 프롬프트가 헛짚은 값이 DB에 남지 않게 한다.
 */

export const ratioFindingItemSchema = z.object({
  /**
   * year: 문구의 날짜 연도가 스케줄 연도 집합에 없음 / schedule: 날짜·시각 불일치 /
   * missing_schedule: 유효 스케줄이 0줄(경쟁률 자체가 열리지 않음, 연도·일정
   * 불일치보다 심각 — 대구가톨릭대 1046110 재현)
   */
  type: z.enum(["year", "schedule", "missing_schedule"]),
  /** 어느 문구에서 발견했는지 — 오픈전 내용 / 상단 내용 / schedule: 특정 문구가 아닌 스케줄 영역 자체 */
  field: z.enum(["pre_open", "top", "schedule"]),
  found: z.string().min(1),
  expect: z.string().min(1),
  quote: z.string().default(""),
});

export const ratioFindingSchema = z.object({
  serviceId: z.number().int().positive(),
  /** Moa Seq(1부터 시작) — 같은 serviceId에 1차/2차 등 별도 설정 페이지가 있을 수 있어 구분에 필요 */
  seq: z.number().int().positive(),
  universityName: z.string().min(1),
  serviceName: z.string().default(""),
  operatorName: z.string().default(""),
  /**
   * Moa 스케줄 세팅 원문('테스트용' 제외 후). 알림에서 '무엇이 기준인지'를
   * claude 요약값(items[].expect)이 아니라 실제 세팅으로 보여주기 위해 싣는다.
   * 스케줄 자체가 없는 건(missing_schedule)은 빈 배열이 정상이다.
   */
  scheduleLines: z.array(z.string()).default([]),
  // 이상이 없으면 finding 자체를 보내지 않는다(빈 items는 계약 위반).
  items: z.array(ratioFindingItemSchema).min(1),
});

export const ratioLinkErrorSchema = z.object({
  serviceId: z.number().int().positive(),
  url: z.string().url(),
  /** HTTP 상태코드. 요청 자체가 실패하면 0 */
  status: z.number().int().nonnegative(),
  reason: z.string().default(""),
  /**
   * 담당자 개인 채팅으로 보내려면 누구 담당인지 알아야 한다.
   * 대상 목록(closing_services)에 없는 serviceId면 빈 문자열이 정상.
   */
  universityName: z.string().default(""),
  serviceName: z.string().default(""),
  operatorName: z.string().default(""),
});

export const ratioSkippedSchema = z.object({
  serviceId: z.number().int().positive(),
  reason: z.string().min(1),
});

/**
 * 점검 종류 — 실행 버튼이 둘로 나뉘어 있다.
 * schedule: TEST 서버 스케줄·안내 문구 대조 / page: REAL 서버 경쟁률 HTML 링크 상태.
 */
export const ratioAuditKindSchema = z.enum(["schedule", "page"]);

export const ratioAuditIngestSchema = z.object({
  // 종류를 안 보내는 구버전 스크래퍼는 스케줄 점검으로 본다.
  kind: ratioAuditKindSchema.default("schedule"),
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
export type RatioAuditKind = z.infer<typeof ratioAuditKindSchema>;
