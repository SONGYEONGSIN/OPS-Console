/**
 * Dashboard 정적 데이터 — design-ref/folio-dashboard.html 그대로 옮김.
 * 추후 Supabase 등 실제 데이터 소스로 교체 시 이 파일이 첫 번째 절단점.
 */

/* ════════════════════════════════════════════════════════════
   Sidebar
   ════════════════════════════════════════════════════════════ */
export type SbPattern = "list" | "dash" | "log" | "settings" | "project";

export type SbItem = {
  ico: string;
  label: string;
  count?: string;
  slug?: string;
  pattern?: SbPattern;
  adminOnly?: boolean;
};
export type SbGroup = {
  kind: "group";
  label: string;
  count?: string;
  defaultOpen?: boolean;
  items: SbItem[];
};
export type SbEntry = ({ kind: "item" } & SbItem) | SbGroup;
export type SbSection = { title: string; entries: SbEntry[] };

export const sidebarSections: SbSection[] = [
  {
    title: "개요",
    entries: [
      { kind: "item", ico: "◉", label: "실시간 현황" },
      {
        kind: "item",
        ico: "✓",
        label: "오늘 할 일",
        count: "",
        slug: "my-todo",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "◰",
        label: "운영부 달력",
        count: "",
        slug: "schedule",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "▤",
        label: "운영부 뉴스",
        count: "",
        slug: "news",
        pattern: "list",
      },
    ],
  },
  {
    title: "요청 · 자료",
    entries: [
      {
        kind: "item",
        ico: "◈",
        label: "인수인계",
        count: "",
        slug: "handover",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "⌬",
        label: "백업요청",
        count: "",
        slug: "backup",
        pattern: "list",
      },
      {
        kind: "group",
        label: "고객응대",
        count: "",
        defaultOpen: true,
        items: [
          {
            ico: "·",
            label: "자료요청",
            count: "",
            slug: "data-requests",
            pattern: "list",
          },
          {
            ico: "·",
            label: "사고보고",
            count: "",
            slug: "incidents",
            pattern: "list",
          },
          {
            ico: "·",
            label: "대학연락처",
            count: "",
            slug: "contacts",
            pattern: "list",
          },
          {
            ico: "·",
            label: "메일함",
            count: "",
            slug: "mailbox",
            pattern: "list",
          },
        ],
      },
      {
        kind: "group",
        label: "자료보관",
        count: "",
        defaultOpen: true,
        items: [
          {
            ico: "·",
            label: "자료실",
            slug: "vault",
            pattern: "list",
          },
          {
            ico: "·",
            label: "회의록",
            count: "",
            slug: "meetings",
            pattern: "list",
          },
          {
            ico: "·",
            label: "견적서",
            count: "",
            slug: "quotes",
            pattern: "list",
          },
        ],
      },
    ],
  },
  {
    title: "서비스 그룹",
    entries: [
      {
        kind: "group",
        label: "서비스사이클",
        count: "",
        defaultOpen: true,
        items: [
          {
            ico: "·",
            label: "총괄장",
            count: "",
            slug: "assignments",
            pattern: "list",
          },
          {
            ico: "·",
            label: "계약",
            count: "",
            slug: "contracts",
            pattern: "list",
          },
          {
            ico: "·",
            label: "서비스 목록",
            count: "",
            slug: "services",
            pattern: "list",
          },
          {
            ico: "·",
            label: "개발 · 테스트",
            count: "",
            slug: "dev-test",
            pattern: "list",
          },
          {
            ico: "·",
            label: "배포 · 운영",
            count: "",
            slug: "deploy",
            pattern: "list",
          },
          {
            ico: "·",
            label: "서비스 마감",
            count: "",
            slug: "closing",
            pattern: "list",
          },
          {
            ico: "·",
            label: "전형료 정산",
            count: "",
            slug: "settlement",
            pattern: "list",
          },
          {
            ico: "·",
            label: "계산서 발행",
            count: "",
            slug: "invoice",
            pattern: "list",
          },
          {
            ico: "·",
            label: "미수 채권",
            count: "",
            slug: "receivables",
            pattern: "list",
          },
        ],
      },
      {
        kind: "group",
        label: "프로젝트",
        count: "",
        items: [
          {
            ico: "·",
            label: "PIMS",
            count: "",
            slug: "pims",
            pattern: "project",
          },
          {
            ico: "·",
            label: "접수관리자",
            count: "",
            slug: "reception-admin",
            pattern: "project",
          },
          {
            ico: "·",
            label: "내부관리자",
            count: "",
            slug: "internal-admin",
            pattern: "project",
          },
          {
            ico: "·",
            label: "경쟁률",
            count: "",
            slug: "competition",
            pattern: "project",
          },
          {
            ico: "·",
            label: "생성툴",
            count: "",
            slug: "generator",
            pattern: "project",
          },
          {
            ico: "·",
            label: "매출 분석",
            count: "",
            slug: "revenue",
            pattern: "project",
          },
          {
            ico: "·",
            label: "정산 · 진학캐쉬",
            count: "",
            slug: "jh-cash",
            pattern: "project",
          },
          { ico: "·", label: "초중고", slug: "k12", pattern: "project" },
          { ico: "·", label: "인증", slug: "certification", pattern: "project" },
          { ico: "·", label: "대교협 연계", slug: "kcue", pattern: "project" },
          {
            ico: "·",
            label: "추천인 검증",
            count: "",
            slug: "referral",
            pattern: "project",
          },
          {
            ico: "·",
            label: "보증보험",
            slug: "guarantee",
            pattern: "project",
          },
          {
            ico: "·",
            label: "실적증명",
            slug: "performance",
            pattern: "project",
          },
        ],
      },
    ],
  },
  {
    title: "분석 · AI",
    entries: [
      {
        kind: "group",
        label: "분석 & 보고",
        count: "",
        items: [
          {
            ico: "·",
            label: "업무 활동 로그",
            slug: "worklog",
            pattern: "log",
          },
          {
            ico: "·",
            label: "성과 리포트",
            slug: "outcomes",
            pattern: "list",
            adminOnly: true,
          },
          {
            ico: "·",
            label: "분석 보고서",
            count: "",
            slug: "reports",
            pattern: "list",
          },
        ],
      },
      {
        kind: "group",
        label: "AI & 자동화",
        count: "",
        items: [
          {
            ico: "·",
            label: "인사이트",
            count: "",
            slug: "ai-insight",
            pattern: "dash",
          },
          {
            ico: "·",
            label: "어시스턴트",
            slug: "ai-assistant",
            pattern: "dash",
          },
          {
            ico: "·",
            label: "내 작업",
            count: "",
            slug: "my-ai-work",
            pattern: "list",
          },
          {
            ico: "·",
            label: "TIP 공유",
            count: "",
            slug: "ai-tips",
            pattern: "list",
          },
          {
            ico: "·",
            label: "자동화 실행",
            slug: "automations",
            pattern: "list",
          },
        ],
      },
    ],
  },
  {
    title: "매뉴얼 · 가이드",
    entries: [
      {
        kind: "item",
        ico: "§",
        label: "운영 매뉴얼",
        slug: "manuals",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "⌘",
        label: "운영 가이드",
        count: "",
        slug: "operating-guide",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "¶",
        label: "FAQ · 사례집",
        slug: "faq",
        pattern: "list",
      },
    ],
  },
  {
    title: "관리",
    entries: [
      {
        kind: "item",
        ico: "◐",
        label: "조직 · 권한",
        count: "",
        slug: "team",
        pattern: "list",
        adminOnly: true,
      },
      {
        kind: "item",
        ico: "⚙",
        label: "시스템 설정",
        count: "",
        slug: "settings",
        pattern: "settings",
        adminOnly: true,
      },
      {
        kind: "item",
        ico: "✦",
        label: "온보딩",
        count: "",
        slug: "onboarding",
        pattern: "settings",
      },
      {
        kind: "item",
        ico: "⚒",
        label: "개선요청",
        count: "",
        slug: "feedback",
        pattern: "list",
      },
      {
        kind: "item",
        ico: "✉",
        label: "공지사항",
        count: "",
        slug: "notices",
        pattern: "list",
        adminOnly: true,
      },
    ],
  },
];

/**
 * slug → SbItem 전체 반환 (count 포함). pattern은 lookup 가드를 통과한
 * 항목만 반환하므로 호출자 입장에서 항상 정의되어 있음을 타입으로 표현.
 */
export function findSidebarMeta(
  slug: string,
): (SbItem & { pattern: SbPattern }) | null {
  for (const section of sidebarSections) {
    for (const entry of section.entries) {
      if (entry.kind === "item" && entry.slug === slug && entry.pattern) {
        const { kind: _kind, ...item } = entry;
        return { ...item, pattern: entry.pattern };
      }
      if (entry.kind === "group") {
        for (const item of entry.items) {
          if (item.slug === slug && item.pattern) {
            return { ...item, pattern: item.pattern };
          }
        }
      }
    }
  }
  return null;
}

/* ════════════════════════════════════════════════════════════
   Service rows (콘텐츠 본체)
   ════════════════════════════════════════════════════════════ */
export type ServiceStatus = "urgent" | "draft" | "review" | "approved";
export type IcoTone = "vm" | "ig" | "gd" | "sg";

export type ServiceRow = {
  id: string;
  ico: string;
  icoTone: IcoTone;
  name: string;
  sub: string;
  status: ServiceStatus;
  statusLabel: string;
  team: string;
  lastEvent: string;
  tag: string;
  inspector: InspectorDetail;
};

/* ════════════════════════════════════════════════════════════
   Inspector detail — 데이터 레이어 (JSX 결합 X, tone 메타로만 표현)
   추후 Supabase 연결 시 이 shape 그대로 fetch.
   ════════════════════════════════════════════════════════════ */
export type InsTone = "sage" | "gold" | "vermilion";

/** 값에 강조 색/굵기/주석 메타가 필요한 케이스용. 단순 문자열이 기본. */
export type InsValue =
  | string
  | { text: string; tone?: InsTone; bold?: boolean; suffix?: string };

export type InsField = { k: string; v: InsValue };

export type TimelineRow = { who: string; act: string; tm: string };

export type InspectorDetail = {
  /** 헤더 ref 라인 — "SVC-PAY-001 · v2.14.3 · PROD" 형태 */
  ref: string;
  /** 우측 작은 낙관 배지 글자. 미지정 시 status에 따라 자동 결정. */
  sealLabel?: string;
  /** § 속성 */
  attributes: InsField[];
  /** § 실시간 지표 */
  metrics: InsField[];
  /** § 담당 · 온콜 */
  oncall: InsField[];
  /** § 분류 및 의존 — 태그 그룹 (각각 0개 가능) */
  taxonomy: { env: string[]; upstream: string[]; downstream: string[] };
  /** § 활동 기록 — 비어있으면 placeholder 노출 */
  timeline: TimelineRow[];
};

/**
 * placeholder inspector — 결제 게이트웨이 외 7개 서비스에 사용.
 * 행 데이터(team/sub/lastEvent)에서 derive해 행 클릭 시 헤더+일부 필드 변동을 보장.
 * Supabase 연결 (#1) 시 풍부한 데이터로 교체.
 */
function placeholderInspector(args: {
  id: string;
  sub: string;
  team: string;
  lastEvent: string;
  statusLabel: string;
}): InspectorDetail {
  return {
    ref: args.sub,
    attributes: [
      { k: "서비스 ID", v: args.id.toLowerCase() },
      { k: "상태", v: args.statusLabel },
      { k: "마지막 이벤트", v: args.lastEvent },
    ],
    metrics: [{ k: "지표", v: "Supabase 연결 후 실시간 표시됩니다." }],
    oncall: [{ k: "담당 팀", v: args.team }],
    taxonomy: { env: [], upstream: [], downstream: [] },
    timeline: [],
  };
}

export const services: ServiceRow[] = [
  {
    id: "SVC-PAY-001",
    ico: "긴",
    icoTone: "vm",
    name: "결제 게이트웨이",
    sub: "SVC-PAY-001 · v2.14.3 · 12 인스턴스 · p99 184ms",
    status: "urgent",
    statusLabel: "장애",
    team: "박현주 · 결제팀",
    lastEvent: "12분 전",
    tag: "API",
    inspector: {
      ref: "SVC-PAY-001 · v2.14.3 · PROD",
      attributes: [
        { k: "서비스 ID", v: "svc-pay-gw-001" },
        { k: "네임스페이스", v: "acme / payments" },
        { k: "인스턴스", v: "12개 실행 중 · 오토스케일 3 – 20" },
        { k: "포트", v: ":8080 HTTP · :9000 gRPC" },
        { k: "리전", v: "ap-northeast-2 · 3 AZ" },
        { k: "런타임", v: "Java 17 · Spring Boot 3.1" },
      ],
      metrics: [
        {
          k: "처리량",
          v: { text: "12,480 req/s", suffix: "▲ 8.2% 전일 대비", tone: "sage" },
        },
        {
          k: "p99 응답",
          v: {
            text: "184 ms · 임계 150ms 초과",
            tone: "vermilion",
            bold: true,
          },
        },
        {
          k: "오류율",
          v: { text: "0.42% · 경고 단계", tone: "vermilion", bold: true },
        },
        { k: "CPU", v: "62% · 12 인스턴스 평균" },
        { k: "메모리", v: { text: "78% · 임계 85% 근접", tone: "gold" } },
      ],
      oncall: [
        { k: "담당 팀", v: "결제팀 · L3 엔지니어링" },
        { k: "1차 온콜", v: "박현주 · 다음 교대까지 7시간" },
        { k: "2차 온콜", v: "김지현" },
        { k: "에스컬레이션", v: "플랫폼 엔지니어링 (자동 · T+30m)" },
      ],
      taxonomy: {
        env: ["#PROD", "#다중리전"],
        upstream: ["#auth", "#user"],
        downstream: ["#stripe", "#fraud", "#inv-db"],
      },
      timeline: [
        {
          who: "박현주",
          act: "DB 커넥션 풀 재시작 스크립트 실행",
          tm: "지금 · 14:32",
        },
        {
          who: "시스템",
          act: "런북 RB-087 자동 실행 · 커넥션 풀 소진 대응",
          tm: "14:28 · 4분 전",
        },
        {
          who: "박현주",
          act: "장애 등록 · P1으로 승격",
          tm: "14:12 · 20분 전",
        },
        {
          who: "Prometheus",
          act: "자동 감지 · 오류율 0.5% 임계값 초과",
          tm: "13:50 · 42분 전",
        },
      ],
    },
  },
  {
    id: "SVC-MSG-003",
    ico: "긴",
    icoTone: "vm",
    name: "알림 큐 (Kafka)",
    sub: "SVC-MSG-003 · v3.6.0 · 브로커 3 · Lag 18.2K",
    status: "urgent",
    statusLabel: "장애",
    team: "김지현 · 플랫폼팀",
    lastEvent: "2시간 전",
    tag: "큐",
    inspector: placeholderInspector({
      id: "SVC-MSG-003",
      sub: "SVC-MSG-003 · v3.6.0 · PROD",
      team: "김지현 · 플랫폼팀",
      lastEvent: "2시간 전",
      statusLabel: "장애",
    }),
  },
  {
    id: "SVC-USR-001",
    ico: "접",
    icoTone: "ig",
    name: "회원 서비스",
    sub: "SVC-USR-001 · v4.8.1 · 8 인스턴스 · p99 42ms",
    status: "approved",
    statusLabel: "정상",
    team: "운영팀 공통",
    lastEvent: "1시간 전 배포",
    tag: "서비스",
    inspector: placeholderInspector({
      id: "SVC-USR-001",
      sub: "SVC-USR-001 · v4.8.1 · PROD",
      team: "운영팀 공통",
      lastEvent: "1시간 전 배포",
      statusLabel: "정상",
    }),
  },
  {
    id: "SVC-AUTH-001",
    ico: "접",
    icoTone: "ig",
    name: "인증 · SSO",
    sub: "SVC-AUTH-001 · v5.1.7 · 24.1K req/s · p99 18ms",
    status: "approved",
    statusLabel: "정상",
    team: "보안팀",
    lastEvent: "어제 18:22",
    tag: "서비스",
    inspector: placeholderInspector({
      id: "SVC-AUTH-001",
      sub: "SVC-AUTH-001 · v5.1.7 · PROD",
      team: "보안팀",
      lastEvent: "어제 18:22",
      statusLabel: "정상",
    }),
  },
  {
    id: "SVC-CAT-001",
    ico: "접",
    icoTone: "ig",
    name: "상품 카탈로그",
    sub: "SVC-CAT-001 · v3.2.0 · 6 인스턴스 · p99 58ms",
    status: "approved",
    statusLabel: "정상",
    team: "박현주 · 카탈로그팀",
    lastEvent: "4월 20일",
    tag: "서비스",
    inspector: placeholderInspector({
      id: "SVC-CAT-001",
      sub: "SVC-CAT-001 · v3.2.0 · PROD",
      team: "박현주 · 카탈로그팀",
      lastEvent: "4월 20일",
      statusLabel: "정상",
    }),
  },
  {
    id: "DB-PRI-001",
    ico: "저",
    icoTone: "sg",
    name: "DB 마스터 (Postgres)",
    sub: "DB-PRI-001 · PG 15.4 · 연결 42/100 · QPS 1.8K",
    status: "approved",
    statusLabel: "정상",
    team: "DBA · 데이터팀",
    lastEvent: "4월 19일 백업",
    tag: "DB",
    inspector: placeholderInspector({
      id: "DB-PRI-001",
      sub: "DB-PRI-001 · PG 15.4 · PROD",
      team: "DBA · 데이터팀",
      lastEvent: "4월 19일 백업",
      statusLabel: "정상",
    }),
  },
  {
    id: "CACHE-RDS-001",
    ico: "저",
    icoTone: "sg",
    name: "Redis 캐시 클러스터",
    sub: "CACHE-RDS-001 · v7.2.3 · 3 노드 · Hit 94% · Mem 52%",
    status: "draft",
    statusLabel: "주의",
    team: "박현주 · 플랫폼팀",
    lastEvent: "1시간 전",
    tag: "캐시",
    inspector: placeholderInspector({
      id: "CACHE-RDS-001",
      sub: "CACHE-RDS-001 · v7.2.3 · PROD",
      team: "박현주 · 플랫폼팀",
      lastEvent: "1시간 전",
      statusLabel: "주의",
    }),
  },
  {
    id: "BATCH-WRK-001",
    ico: "배",
    icoTone: "gd",
    name: "배치 워커 · 일 마감",
    sub: "BATCH-WRK-001 · v1.9.4 · 6 워커 · 큐 12 · 성공률 99.6%",
    status: "approved",
    statusLabel: "정상",
    team: "운영팀 · 배치 담당",
    lastEvent: "방금",
    tag: "배치",
    inspector: placeholderInspector({
      id: "BATCH-WRK-001",
      sub: "BATCH-WRK-001 · v1.9.4 · PROD",
      team: "운영팀 · 배치 담당",
      lastEvent: "방금",
      statusLabel: "정상",
    }),
  },
];
