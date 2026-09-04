import { z } from "zod";

/**
 * 명세서 항목 하나 — 학교 담당자가 읽는 단위.
 *
 * `key` 가 안정적이어야 재생성해도 운영자의 '제외' 결정이 살아남는다.
 * `dev_control_analyses.flags` 의 key 와 같은 역할이다.
 */
export const devControlSpecItemSchema = z.object({
  key: z.string().min(1),
  /** 비개발자 언어 한 줄. 파일명·변수명·코드가 들어가면 안 된다. */
  title: z.string().min(1),
  /** 지원자가 겪는 일로 쓴 설명. */
  body: z.string(),
  /** 끄면 **메일에서만** 빠진다. 화면에는 계속 남는다. */
  included: z.boolean(),
});
export type DevControlSpecItem = z.infer<typeof devControlSpecItemSchema>;

export type DevControlSpec = {
  id: string;
  service_id: number;
  items: DevControlSpecItem[];
  /** 코드를 걷어 온 시각 — 학교에 나가는 문서라 이게 곧 신뢰다. */
  source_analyzed_at: string | null;
  generated_at: string;
};

/** 명세서 생성 요청 — 저장된 raw_code 로 만든다(수집을 다시 하지 않는다). */
export const requestDevControlSpecSchema = z.object({
  serviceId: z.number().int().positive(),
});

/** 항목 포함/제외 토글. */
export const toggleSpecItemSchema = z.object({
  serviceId: z.number().int().positive(),
  itemKey: z.string().min(1),
  included: z.boolean(),
});

export const specCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

/**
 * 발송 입력.
 *
 * **본문을 폼에서 받지 않는다** — 항목과 제외 결정은 DB 에 있고, 서버가 거기서
 * 다시 만든다. 폼을 믿으면 화면에서 끈 항목이 그대로 실려 나갈 수 있다.
 */
export const sendDevControlSpecSchema = z.object({
  serviceId: z.number().int().positive(),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(specCcSchema).default([]),
});

export type DevControlSpecSendStatus = "sent" | "dry_run" | "failed";

export type DevControlSpecSend = {
  id: string;
  service_id: number;
  university_name: string | null;
  to_email: string;
  subject: string;
  status: DevControlSpecSendStatus;
  error_message: string | null;
  sent_by: string | null;
  sent_at: string;
};
