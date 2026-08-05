import { z } from "zod";

/**
 * 합격자통합관리시스템(발표) 서비스 — 붙여넣기 업로드의 신뢰 경계.
 *
 * 사람이 엑셀에서 복사해 붙여넣는 값이라 여기서 좁힌다. 서비스ID는 합통 UnivServiceId로
 * 원서접수(Moa) service_id와 체계가 다르다.
 */
export const announcementServiceSchema = z.object({
  service_id: z.number().int().positive(),
  university_id: z.number().int().positive().optional(),
  university_name: z.string().min(1),
  service_name: z.string().min(1),
  /** 가장 최근 발표일시(ISO). 자료에 없을 수 있어 optional. */
  last_announce_at: z.string().datetime().optional(),
});

export type AnnouncementServiceInput = z.infer<
  typeof announcementServiceSchema
>;

/** 검색 후보 1건 — 백업 요청 EditForm이 쓰는 최소 형태. */
export type AnnouncementServiceCandidate = {
  service_id: number;
  university_name: string;
  service_name: string;
};
