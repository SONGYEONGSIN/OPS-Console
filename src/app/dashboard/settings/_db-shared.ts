/** 시스템 설정 > DB 정보 — client/server 공유 타입 + 포맷터. server-only 의존성 없음. */

export type DbTableMeta = {
  table: string;
  label: string;
};

export const DB_TABLES: DbTableMeta[] = [
  { table: "operators", label: "운영자" },
  { table: "services", label: "서비스" },
  { table: "contacts", label: "대학 연락처" },
  { table: "incidents", label: "사고 보고" },
  { table: "handover_records", label: "인수인계 내용" },
  { table: "handover_progress", label: "인수인계 진행" },
  { table: "backup_requests", label: "백업 요청" },
  { table: "ai_work", label: "내 작업" },
  { table: "ai_tips", label: "TIP 공유" },
  { table: "worklog", label: "업무 활동 로그" },
  { table: "schedule_events", label: "운영부 달력" },
  { table: "todos", label: "내 할 일" },
  { table: "posts", label: "공지/개선요청" },
  { table: "onboarding_cohorts", label: "온보딩 회차" },
];

export type DbSnapshotRow = {
  table: string;
  label: string;
  count: number | null;
};

export type DbSnapshot = {
  rows: DbSnapshotRow[];
  fetchedAt: string;
};

export function formatDbSnapshot(count: number | null): string {
  if (count === null) return "집계 실패";
  return `${count.toLocaleString("ko-KR")}건`;
}
