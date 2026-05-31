/**
 * 월별 서비스 알림 (service-notice) 도메인 타입.
 * 원본 GAS "월별 서비스 알림 자동 메일링"의 (A) 운영자 알림을 OPS-Console로 이전.
 * 데이터 소스는 GAS의 "DB 시트"가 아니라 `services` 테이블.
 */

/** 다음 달 작성시작 대상 서비스 (services 행의 필요한 필드만). */
export type ServiceNoticeService = {
  id: string;
  universityName: string;
  serviceName: string;
  universityType: string;
  category: string;
  operatorEmail: string;
  operatorName: string | null;
  writeStartAt: string;
  writeEndAt: string | null;
  payStartAt: string | null;
  payEndAt: string | null;
};

/** 운영자별로 묶인 알림 그룹 — 운영자 본인 메일로 1통 발송 단위. */
export type ServiceNoticeGroup = {
  operator: { email: string; name: string };
  /** writeStartAt 오름차순 정렬 */
  services: ServiceNoticeService[];
};
