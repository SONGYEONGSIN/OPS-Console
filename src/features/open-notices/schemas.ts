import { z } from "zod";

export const openNoticeCcSchema = z.object({
  email: z.string().email(),
  name: z.string().optional(),
});

export const sendOpenNoticeInputSchema = z.object({
  /**
   * Moa 서비스ID. 자료요청과 달리 **필수**다 — 목록이 항상 주고,
   * 없으면 접수주소·경쟁률 URL 을 만들 수 없다.
   *
   * FormData 는 문자열로 오므로 숫자 문자열만 변환한다. `z.coerce.number()`
   * 는 쓰지 않는다 — `Number(null)` 이 0 이라 serviceId 누락이 통과하고
   * `/Notice/0/A` 라는 죽은 링크가 대학에 나간다.
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
  mode: z.enum(["now", "schedule"]).default("now"),
  scheduledAt: z.string().optional(),
});

export type SendOpenNoticeInput = z.infer<typeof sendOpenNoticeInputSchema>;
export type OpenNoticeCc = z.infer<typeof openNoticeCcSchema>;
