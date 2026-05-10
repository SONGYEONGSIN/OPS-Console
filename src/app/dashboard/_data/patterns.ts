import { OPERATORS } from "@/features/auth/operators";
import type { ListRow } from "../_components/patterns/ListPattern";
import type { DashWidget } from "../_components/patterns/DashPattern";
import type { LogLine } from "../_components/patterns/LogPattern";
import type { SettingsField, SettingsSection } from "../_components/patterns/SettingsPattern";
import type { SbPattern } from "../_data";

export type ProjectMockData = {
  meta: {
    manager: string;
    status: string;
    quarterTarget: string;
    serviceCount: string;
  };
  attributes: { k: string; v: string }[];
  improvements: {
    title: string;
    pm: string;
    due: string;
    status: "run" | "rev" | "wait";
  }[];
  activities: { time: string; who: string; act: string }[];
};

const listMockRows: ListRow[] = [
  { id: "SVC-001", name: "결제 게이트웨이", status: "urgent",   owner: "김슬기",   meta: "최근 배포 14:23" },
  { id: "SVC-002", name: "회원 서비스",     status: "active",   owner: "정윤나",   meta: "정상" },
  { id: "SVC-003", name: "검색 인덱서",     status: "review",   owner: "한효진",   meta: "재인덱싱 중" },
  { id: "SVC-004", name: "알림 발송기",     status: "active",   owner: "김유민",   meta: "정상" },
  { id: "SVC-005", name: "주문 워커",       status: "approved", owner: "박시현",   meta: "지난 주 안정" },
  { id: "SVC-006", name: "이미지 처리",     status: "active",   owner: "전지은",   meta: "정상" },
  { id: "SVC-007", name: "리포트 생성기",   status: "review",   owner: "임종우",   meta: "월말 점검" },
  { id: "SVC-008", name: "헬스체크 봇",     status: "approved", owner: "이해영",   meta: "30일 무중단" },
];

/**
 * 개선 요청 mock — OPS Console 시스템 자체에 대한 개선 아이디어/버그.
 * 운영부 전원이 작성 가능, 검토 후 처리 상태로 갱신.
 */
const feedbackMockRows: ListRow[] = [
  {
    id: "FB-004",
    name: "인스펙터 패널 width 320px이 좁음 — 본문이 잘림",
    status: "urgent",
    owner: "송영신",
    meta: "2026-05-09",
    body: "team 페이지에서 row 클릭 시 우측 패널이 320px 고정인데, 직급/팀/이메일이 한 줄에 안 들어와서 줄바꿈이 어색합니다. 최소 360px 이상 또는 사용자 조정 가능한 너비를 검토해주세요.",
  },
  {
    id: "FB-003",
    name: "사용자 권한 변경이 즉시 반영되지 않음",
    status: "review",
    owner: "김지영",
    meta: "2026-05-08",
    body: "admin이 다른 사용자의 권한을 member로 변경했을 때, 해당 사용자의 다른 탭/세션은 새로고침 전까지 admin으로 동작합니다. 즉시 회수가 안전한지 검토 필요.",
  },
  {
    id: "FB-002",
    name: "모바일 햄버거 트리거 누락 회귀 — chrome 리브랜드",
    status: "approved",
    owner: "정윤나",
    meta: "2026-05-08",
    body: "PIVOT→OPS Console 리브랜드 시 AppBar의 '메뉴 열기' 버튼이 누락되었던 회귀. PR #7로 SidebarToggleProvider 도입 후 복구 완료.",
  },
  {
    id: "FB-001",
    name: "알림 모달에 외부 클릭으로 닫기 추가 요청",
    status: "active",
    owner: "김슬기",
    meta: "2026-05-07",
    body: "현재는 ESC 또는 X 버튼만 닫기 가능합니다. 다른 모달처럼 모달 외부 영역(scrim) 클릭으로도 닫히게 해주세요.",
  },
];

/**
 * 공지사항 mock — 운영부 전체 전달.
 * admin(부장·팀장)만 작성, 모두 read.
 */
const noticesMockRows: ListRow[] = [
  {
    id: "NT-003",
    name: "2026 Q3 운영 정책 변경 — 시프트 스케줄 조정 안내",
    status: "urgent",
    owner: "허승철 · 부장",
    meta: "2026-05-10",
    body: "Q3부터 시프트 스케줄을 2교대 → 3교대 시범 운영합니다. 1차 06:00–14:00 / 2차 14:00–22:00 / 3차 22:00–06:00. 자세한 인원 배정은 5/20 주간 회의에서 공유합니다.",
  },
  {
    id: "NT-002",
    name: "시스템 정기 점검 — 5/15(목) 23:00 ~ 익일 02:00",
    status: "active",
    owner: "송영신 · 팀장",
    meta: "2026-05-09",
    body: "Supabase Postgres 마이너 버전 업그레이드와 인증 SMTP 교체 작업이 진행됩니다. 점검 시간 동안 OPS Console 접속이 일시 차단될 수 있으니 미리 대시보드를 닫아주세요.",
  },
  {
    id: "NT-001",
    name: "신규 운영자 합류 — 김지나 사원 (운영2팀)",
    status: "approved",
    owner: "송영신 · 팀장",
    meta: "2026-05-07",
    body: "운영2팀에 김지나 사원(매니저)이 합류했습니다. 첫 주는 OJT로 시프트에서 제외하고, 5/14(수)부터 정상 시프트 투입 예정입니다. 환영해 주세요.",
  },
];

const dashMockWidgets: DashWidget[] = [
  { id: "W1", tone: "urgent", label: "결제 지연",         value: "350ms",  time: "14:23" },
  { id: "W2", tone: "ok",     label: "정상 서비스",        value: "47건",  time: "24h" },
  { id: "W3", tone: "review", label: "점검중 인프라",      value: "2건",   time: "30m" },
  { id: "W4", tone: "ok",     label: "API 평균 응답",      value: "82ms",  time: "1h" },
  { id: "W5", tone: "urgent", label: "에러율 임계 초과",   value: "1.4%",  time: "5m" },
  { id: "W6", tone: "ok",     label: "활성 사용자",        value: "1,287", time: "현재" },
];

/**
 * alerts 페이지 전용 mock — JINHAK 운영부 알림 도메인.
 * 진학사 운영2팀(2교대 14:00~22:00 KST) 시점 가정의 실시간 운영 신호.
 * dashMockWidgets와 분리해 페이지 의도(알림 트리아지)에 맞춤.
 */
const alertsWidgets: DashWidget[] = [
  { id: "ALERT-01", tone: "urgent", label: "신규 긴급 알림",        value: "3건",     time: "지난 1h" },
  { id: "ALERT-02", tone: "urgent", label: "결제 게이트웨이 응답",  value: "350ms",   time: "14:23" },
  { id: "ALERT-03", tone: "urgent", label: "새 사고 보고",          value: "2건",     time: "오늘" },
  { id: "ALERT-04", tone: "review", label: "처리 대기 알림",        value: "12건",    time: "현재" },
  { id: "ALERT-05", tone: "review", label: "미처리 자료 요청",      value: "5건",     time: "24h" },
  { id: "ALERT-06", tone: "ok",     label: "오늘 처리 완료",        value: "47건",    time: "완료율 92%" },
  { id: "ALERT-07", tone: "ok",     label: "온콜 응답시간 (평균)",  value: "8.2분",   time: "주간" },
  { id: "ALERT-08", tone: "review", label: "TLS 인증서 만료 임박",  value: "2개",     time: "30일 내" },
  { id: "ALERT-09", tone: "ok",     label: "백업 성공",              value: "4.7GB",   time: "오늘 02:00" },
];

const logMockLines: LogLine[] = [
  { ts: "14:23:45", level: "INFO",  msg: "결제 게이트웨이 헬스체크 통과 (200ms)" },
  { ts: "14:23:42", level: "WARN",  msg: "API latency 350ms (>200) — payment-svc" },
  { ts: "14:23:01", level: "ERROR", msg: "DB 연결 실패 — retry 3/3, fallback active" },
  { ts: "14:22:59", level: "INFO",  msg: "주문 워커 큐 1024건 처리 완료" },
  { ts: "14:22:30", level: "DEBUG", msg: "캐시 hit ratio: 0.87 (target 0.85)" },
  { ts: "14:22:00", level: "INFO",  msg: "스케줄러 작업 'daily-cleanup' 시작" },
  { ts: "14:21:45", level: "WARN",  msg: "메모리 사용률 78% (warning 75%)" },
  { ts: "14:21:30", level: "INFO",  msg: "사용자 'ys1114@jinhakapply.com' 로그인" },
  { ts: "14:21:00", level: "ERROR", msg: "외부 API 타임아웃 — partner-gw 응답 없음" },
  { ts: "14:20:45", level: "INFO",  msg: "이미지 처리 완료 — batch-2026-04-28-001" },
  { ts: "14:20:30", level: "DEBUG", msg: "GC 통계: young 12ms, old 0ms" },
  { ts: "14:20:00", level: "INFO",  msg: "헬스체크 라운드 #4521 시작" },
  { ts: "14:19:45", level: "WARN",  msg: "디스크 I/O 응답 시간 증가 — node-3" },
  { ts: "14:19:30", level: "INFO",  msg: "리포트 생성기 일일 보고서 발송 완료" },
  { ts: "14:19:00", level: "ERROR", msg: "결제 콜백 처리 실패 — txn-abc-123" },
  { ts: "14:18:45", level: "INFO",  msg: "사용자 'kjh@jinhakapply.com' 로그아웃" },
  { ts: "14:18:30", level: "DEBUG", msg: "Connection pool 활성: 24/100" },
  { ts: "14:18:00", level: "INFO",  msg: "변경 관리 #CR-2026-042 승인됨" },
  { ts: "14:17:45", level: "WARN",  msg: "캐시 evict 빈도 증가 — 점검 필요" },
  { ts: "14:17:30", level: "INFO",  msg: "검색 인덱서 재구축 완료 (2.3M docs)" },
  { ts: "14:17:00", level: "ERROR", msg: "메시지 큐 dead-letter 5건 발생" },
  { ts: "14:16:45", level: "INFO",  msg: "API rate limit 일일 통계 reset" },
  { ts: "14:16:30", level: "DEBUG", msg: "JWT 만료 임박 — 1240명" },
  { ts: "14:16:00", level: "INFO",  msg: "알림 발송기 SMS 47건, 이메일 213건 발송" },
  { ts: "14:15:45", level: "WARN",  msg: "외부 SMTP 연결 지연 (3.2s)" },
  { ts: "14:15:30", level: "INFO",  msg: "온콜 교대 — 운영2팀 송영신 → 운영1팀 한효진" },
  { ts: "14:15:00", level: "ERROR", msg: "결제 게이트웨이 타임아웃 — gw-2 격리" },
  { ts: "14:14:45", level: "INFO",  msg: "장애 #INC-2026-042 처리 완료" },
  { ts: "14:14:30", level: "DEBUG", msg: "메모리 GC 트리거" },
  { ts: "14:14:00", level: "INFO",  msg: "헬스체크 라운드 #4520 완료" },
  { ts: "14:13:45", level: "WARN",  msg: "API 응답 P95 200ms 초과 — search-svc" },
  { ts: "14:13:30", level: "INFO",  msg: "Grafana 알림 'high-error-rate' 정상화" },
  { ts: "14:13:00", level: "ERROR", msg: "DB query timeout — orders.findByUser (>5s)" },
  { ts: "14:12:45", level: "INFO",  msg: "캐시 워밍업 완료 — top 1000 keys" },
  { ts: "14:12:30", level: "DEBUG", msg: "Redis cluster 노드 헬스 OK (6/6)" },
  { ts: "14:12:00", level: "INFO",  msg: "배치 #B-2471 시작 — 일일 정산" },
  { ts: "14:11:45", level: "WARN",  msg: "실패한 로그인 시도 임계 초과 — IP 블록" },
  { ts: "14:11:30", level: "INFO",  msg: "변경 관리 #CR-2026-041 적용 완료" },
  { ts: "14:11:00", level: "ERROR", msg: "디스크 공간 부족 경고 — node-2 (85%)" },
  { ts: "14:10:45", level: "INFO",  msg: "사용자 'jkee@jinhakapply.com' MFA 등록" },
  { ts: "14:10:30", level: "DEBUG", msg: "백그라운드 큐 잔여: 0" },
  { ts: "14:10:00", level: "INFO",  msg: "주간 보안 스캔 시작" },
  { ts: "14:09:45", level: "WARN",  msg: "TLS 인증서 30일 내 만료 — auth.opsroom.local" },
  { ts: "14:09:30", level: "INFO",  msg: "API 게이트웨이 트래픽 분산 재조정" },
  { ts: "14:09:00", level: "ERROR", msg: "외부 결제 partner 응답 stat=503" },
  { ts: "14:08:45", level: "INFO",  msg: "헬스체크 라운드 #4519 완료" },
  { ts: "14:08:30", level: "DEBUG", msg: "JVM heap 사용: 2.4G/4G" },
  { ts: "14:08:00", level: "INFO",  msg: "데일리 백업 완료 — 4.7GB" },
  { ts: "14:07:45", level: "WARN",  msg: "노드 부하 imbalance 감지 — auto-rebalance" },
  { ts: "14:07:30", level: "INFO",  msg: "운영부 스케줄 동기화 완료" },
];

const settingsMockSections: SettingsSection[] = [
  {
    id: "general",
    label: "일반",
    fields: [
      { type: "select", label: "언어",   value: "한국어", options: ["한국어", "English"] },
      { type: "select", label: "타임존", value: "Asia/Seoul", options: ["Asia/Seoul", "UTC", "America/Los_Angeles"] },
      { type: "radio",  label: "테마",   value: "dark", options: ["light", "dark"] },
    ],
  },
  {
    id: "alerts",
    label: "알림",
    fields: [
      { type: "toggle", label: "장애 발생 시 데스크탑 알림", value: true },
      { type: "toggle", label: "이메일 요약 (일간)", value: false },
      { type: "toggle", label: "주말 알림 받기", value: false },
    ],
  },
  {
    id: "display",
    label: "표시",
    fields: [
      { type: "select", label: "기본 뷰",   value: "목록", options: ["목록", "카드"] },
      { type: "toggle", label: "고밀도 표시", value: false },
    ],
  },
  {
    id: "security",
    label: "보안",
    fields: [
      { type: "toggle", label: "2단계 인증 (TOTP)", value: false },
      { type: "select", label: "세션 만료", value: "14일", options: ["1시간", "1일", "14일"] },
    ],
  },
  {
    id: "sso",
    label: "통합 (SSO)",
    fields: [
      { type: "toggle", label: "Microsoft SSO 연결", value: true },
    ],
  },
];

/* ════════════════════════════════════════════════════════════
   /dashboard index 전용 mock — 실시간 현황 페이지에서만 사용
   에디토리얼 신문 톤 — Lede + ShiftTimeline + ActivityColumn 등
   ════════════════════════════════════════════════════════════ */

export type DashboardActivity = { time: string; who: string; act: string };
export type ShiftEvent = { at: string; label: string };
export type DashboardHeadline = { lede: string[]; urgentCount: number };

/** Lede zone — 입실자가 첫 3초에 읽을 핵심 사건 (사건 단위 줄 분리) */
export const dashboardHeadline: DashboardHeadline = {
  lede: [
    "결제 게이트웨이 응답 350ms 추이 주시 중",
    "사고 보고 #INC-042 처리 대기",
    "TLS 인증서 2건 30일 내 만료",
  ],
  urgentCount: 3,
};

/** ShiftTimeline zone — 14:00~22:00 KST 시프트 내 주요 일정 */
export const shiftEvents: ShiftEvent[] = [
  { at: "14:00", label: "시프트 개시 · 인수인계 점검" },
  { at: "15:00", label: "PIMS 점검 회의 (운영2팀)" },
  { at: "16:30", label: "보안 스캔 시작 (auto)" },
  { at: "18:00", label: "정산·진학캐쉬 마감 검증" },
  { at: "20:00", label: "백업 검증 라운드" },
  { at: "21:30", label: "교대 인수인계 작성" },
  { at: "22:00", label: "시프트 종료 · 1차 → 3차 교대" },
];

/** ActivityColumn zone — 최근 활동 typographic feed (15건) */
export const dashboardActivities: DashboardActivity[] = [
  { time: "16:42", who: "박지연", act: "PIMS 접수폼 검증 작업 진행" },
  { time: "16:38", who: "김민수", act: "사고 보고 #INC-042 처리 완료" },
  { time: "16:30", who: "정시현", act: "데이터 요청 응답 발송 — 한양대 외 3건" },
  { time: "16:22", who: "이해영", act: "내부관리자 권한 분리 작업 시작" },
  { time: "16:15", who: "한효진", act: "검색 인덱서 재구축 — 2.3M docs 완료" },
  { time: "16:08", who: "박시현", act: "주문 워커 큐 1024건 처리 완료" },
  { time: "15:55", who: "전지은", act: "이미지 처리 batch-2026-04-30-002 완료" },
  { time: "15:48", who: "임종우", act: "리포트 생성기 일일 보고서 발송" },
  { time: "15:40", who: "김유민", act: "알림 발송기 SMS 47건, 이메일 213건" },
  { time: "15:32", who: "정윤나", act: "회원 서비스 헬스체크 통과 (200ms)" },
  { time: "15:25", who: "송영석", act: "TLS 인증서 만료 임박 점검 — 2건 갱신 의뢰" },
  { time: "15:18", who: "박지연", act: "분기 목표 진행률 업데이트 — PIMS 62%" },
  { time: "15:10", who: "한효진", act: "DB 마스터 (Postgres) 연결 풀 점검" },
  { time: "15:02", who: "김민수", act: "장애 #INC-041 처리 완료" },
  { time: "14:55", who: "이해영", act: "온콜 교대 — 운영2팀 송영신 → 한효진" },
];

/** /dashboard index ProjectGrid zone — 12 프로젝트 한 줄 진입점 */
export type DashboardProjectEntry = {
  slug: string;
  label: string;
  manager: string;
  quarter: string;
  count: string;
  suspended?: boolean;
};

export const dashboardProjects: DashboardProjectEntry[] = [
  { slug: "pims",            label: "PIMS",            manager: "박지연", quarter: "Q2 · 62%", count: "14건" },
  { slug: "reception-admin", label: "접수관리자",      manager: "김민수", quarter: "Q2 · 48%", count: "8건"  },
  { slug: "internal-admin",  label: "내부관리자",      manager: "이지훈", quarter: "Q2 · 55%", count: "6건"  },
  { slug: "competition",     label: "경쟁률",          manager: "정수아", quarter: "Q2 · 70%", count: "3건"  },
  { slug: "generator",       label: "생성툴",          manager: "최영준", quarter: "Q2 · 35%", count: "2건"  },
  { slug: "revenue",         label: "매출 분석",       manager: "박지연", quarter: "Q2 · 80%", count: "5건"  },
  { slug: "jh-cash",         label: "정산 · 진학캐쉬", manager: "한지민", quarter: "Q2 · 45%", count: "1건"  },
  { slug: "k12",             label: "초중고 사업",     manager: "송영석", quarter: "Q2 · 25%", count: "준비"  },
  { slug: "kcue",            label: "대교협 연계",     manager: "정수아", quarter: "Q2 · 30%", count: "2건"  },
  { slug: "referral",        label: "추천인 검증",     manager: "김유민", quarter: "Q2 · 65%", count: "7건"  },
  { slug: "guarantee",       label: "보증보험",        manager: "임종우", quarter: "Q3 예정",  count: "검토",  suspended: true },
  { slug: "performance",     label: "실적증명",        manager: "이해영", quarter: "Q2 · 50%", count: "4건"  },
];

/** /dashboard index OnCallPanel zone — 1차/2차 온콜 운영자 */
export const dashboardOnCall = {
  primary:   { name: "송영신", team: "운영2팀", role: "팀장" },
  secondary: { name: "한효진", team: "운영1팀", role: "TL" },
} as const;

/** /dashboard index Masthead vol — 시각적 신문 호수 (gen mock) */
export const dashboardVolume = 214;

/* ════════════════════════════════════════════════════════════
   Project mock — 12 프로젝트별 ProjectMockData
   ════════════════════════════════════════════════════════════ */
function makeProject(args: {
  manager: string;
  team: string;
  status?: string;
  quarterTarget: string;
  serviceCount: string;
  improvements: ProjectMockData["improvements"];
}): ProjectMockData {
  return {
    meta: {
      manager: args.manager,
      status: args.status ?? "진행",
      quarterTarget: args.quarterTarget,
      serviceCount: args.serviceCount,
    },
    attributes: [
      { k: "담당자", v: `${args.manager} · ${args.team}` },
      { k: "서비스 수", v: args.serviceCount },
      { k: "분기 목표", v: args.quarterTarget },
    ],
    improvements: args.improvements,
    activities: [
      { time: "2026-04-29", who: args.manager, act: "분기 점검 및 진행률 업데이트" },
      { time: "2026-04-25", who: args.manager, act: "팀 회의 — 다음 분기 우선순위 정렬" },
    ],
  };
}

const projectMap: Record<string, ProjectMockData> = {
  pims: makeProject({
    manager: "박지연",
    team: "운영1팀",
    quarterTarget: "2026 Q2 · 62%",
    serviceCount: "14건 (배포 12 / 마감 2)",
    improvements: [
      { title: "접수 폼 검증 강화", pm: "박지연", due: "2026-05-15", status: "run" },
      { title: "알림 SMS 템플릿 통일", pm: "김민수", due: "2026-04-30", status: "rev" },
      { title: "관리자 권한 분리", pm: "미정", due: "2026-Q3", status: "wait" },
      { title: "통계 export 자동화", pm: "박지연", due: "2026-Q3", status: "wait" },
    ],
  }),
  "reception-admin": makeProject({
    manager: "김민수",
    team: "운영1팀",
    quarterTarget: "2026 Q2 · 48%",
    serviceCount: "8건",
    improvements: [
      { title: "접수 처리 자동화", pm: "김민수", due: "2026-05-20", status: "run" },
      { title: "권한 등급 재정의", pm: "김민수", due: "2026-Q3", status: "wait" },
    ],
  }),
  "internal-admin": makeProject({
    manager: "이지훈",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 55%",
    serviceCount: "6건",
    improvements: [
      { title: "관리자 UI 개편", pm: "이지훈", due: "2026-06-01", status: "run" },
    ],
  }),
  competition: makeProject({
    manager: "정수아",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 70%",
    serviceCount: "3건",
    improvements: [
      { title: "실시간 경쟁률 캐시 도입", pm: "정수아", due: "2026-05-10", status: "rev" },
    ],
  }),
  generator: makeProject({
    manager: "최영준",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 35%",
    serviceCount: "2건",
    improvements: [
      { title: "생성툴 배포 파이프라인", pm: "최영준", due: "2026-Q3", status: "wait" },
    ],
  }),
  revenue: makeProject({
    manager: "박지연",
    team: "운영1팀",
    quarterTarget: "2026 Q2 · 80%",
    serviceCount: "5건",
    improvements: [
      { title: "월간 매출 리포트 자동화", pm: "박지연", due: "2026-05-30", status: "run" },
    ],
  }),
  "jh-cash": makeProject({
    manager: "한지민",
    team: "운영1팀",
    quarterTarget: "2026 Q2 · 45%",
    serviceCount: "1건",
    improvements: [
      { title: "진학캐쉬 정산 검증 강화", pm: "한지민", due: "2026-06-15", status: "run" },
    ],
  }),
  k12: makeProject({
    manager: "송영석",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 25%",
    serviceCount: "준비",
    improvements: [
      { title: "초중고 사업 운영 정책 수립", pm: "송영석", due: "2026-Q3", status: "wait" },
    ],
  }),
  kcue: makeProject({
    manager: "정수아",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 30%",
    serviceCount: "2건",
    improvements: [
      { title: "대교협 API 연계 검토", pm: "정수아", due: "2026-Q3", status: "wait" },
    ],
  }),
  referral: makeProject({
    manager: "김유민",
    team: "운영1팀",
    quarterTarget: "2026 Q2 · 65%",
    serviceCount: "7건",
    improvements: [
      { title: "추천인 검증 로직 강화", pm: "김유민", due: "2026-05-25", status: "run" },
    ],
  }),
  guarantee: makeProject({
    manager: "임종우",
    team: "운영2팀",
    status: "보류",
    quarterTarget: "2026 Q3 예정",
    serviceCount: "검토",
    improvements: [],
  }),
  performance: makeProject({
    manager: "이해영",
    team: "운영2팀",
    quarterTarget: "2026 Q2 · 50%",
    serviceCount: "4건",
    improvements: [
      { title: "실적증명 자료 표준화", pm: "이해영", due: "2026-06-01", status: "rev" },
    ],
  }),
};

export function getPatternMockData(slug: string, pattern: SbPattern):
  | { rows: ListRow[] }
  | { widgets: DashWidget[] }
  | { lines: LogLine[] }
  | { sections: SettingsSection[] }
  | ProjectMockData {
  // 팀 페이지는 OPERATORS 활용 (실제 17명 운영자)
  if (slug === "team") {
    const teamRows: ListRow[] = OPERATORS.map((op) => ({
      id: op.email,
      name: op.name,
      status: "active",
      owner: op.team,
      meta: op.role,
    }));
    return { rows: teamRows };
  }

  if (pattern === "project") {
    return projectMap[slug] ?? projectMap.pims;
  }

  if (pattern === "dash" && slug === "alerts") return { widgets: alertsWidgets };

  if (pattern === "list") {
    if (slug === "feedback") return { rows: feedbackMockRows };
    if (slug === "notices") return { rows: noticesMockRows };
    return { rows: listMockRows };
  }
  if (pattern === "dash") return { widgets: dashMockWidgets };
  if (pattern === "log") return { lines: logMockLines };
  return { sections: settingsMockSections };
}

export type { SettingsField };
