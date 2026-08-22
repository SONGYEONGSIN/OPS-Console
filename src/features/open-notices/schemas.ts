import { z } from "zod";

export const openNoticeCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

/**
 * 자동 발송 켜기 입력.
 *
 * **발송 시각을 받지 않는다.** 오픈 시각은 `closing_services.write_start_at`
 * 에 이미 있어서, 사람이 다시 입력하게 하면 같은 값을 두 벌로 만드는 것이고
 * 둘이 어긋나면 엉뚱한 시각에 나간다. 서버가 DB 에서 읽는다.
 */
export const openNoticeAutoSendInputSchema = z.object({
  /**
   * Moa 서비스ID. 목록이 항상 주고, 없으면 접수주소·경쟁률 URL 을 만들 수 없다.
   *
   * `z.coerce.number()` 는 쓰지 않는다 — `Number(null)` 이 0 이라 serviceId
   * 누락이 통과하고 `/Notice/0/A` 라는 죽은 링크가 대학에 나간다.
   */
  serviceId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number().int(),
  ),
  universityName: z.string().min(1),
  serviceName: z.string().optional(),
  toEmail: z.string().email(),
  toName: z.string().optional(),
  cc: z.array(openNoticeCcSchema).default([]),
  subject: z.string().min(1),
  body: z.string().min(1),
});

/** 자동 발송 끄기 — 서비스 지정만 */
export const openNoticeCancelInputSchema = z.object({
  serviceId: z.preprocess(
    (v) => (typeof v === "string" && v.trim() !== "" ? Number(v) : v),
    z.number().int(),
  ),
});

export type OpenNoticeAutoSendInput = z.infer<typeof openNoticeAutoSendInputSchema>;
export type OpenNoticeCc = z.infer<typeof openNoticeCcSchema>;
