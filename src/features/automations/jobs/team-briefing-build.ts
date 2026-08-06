/**
 * 팀 뉴스레터 — 순수 집계·메시지 빌더 (외부 의존 없음, 단위 테스트 대상).
 * 데이터 fetch는 team-briefing.ts(잡)에서 수행하고 여기엔 rows/events만 넘긴다.
 */

// ─── 계약진행 현황 ───────────────────────────────────────────

export type ContractAgg = { sheet: string; done: number; ongoing: number };
export type ContractSummary = {
  bySheet: ContractAgg[];
  totalDone: number;
  totalOngoing: number;
};

/**
 * 시트별 완료/진행중 카운트 + 합계.
 * 완료 = status가 "계약완료"로 시작(예: "계약완료", "계약완료(영업)", "계약완료(운영)").
 * 진행중 = 그 외 전부(공란·"메일발송"·"미완료" 등).
 */
export function aggregateContracts(
  rows: { sheet: string; status: string }[],
  sheets: readonly string[],
): ContractSummary {
  const bySheet: ContractAgg[] = sheets.map((sheet) => {
    const inSheet = rows.filter((r) => r.sheet === sheet);
    const done = inSheet.filter((r) => r.status.startsWith("계약완료")).length;
    return { sheet, done, ongoing: inSheet.length - done };
  });
  return {
    bySheet,
    totalDone: bySheet.reduce((a, s) => a + s.done, 0),
    totalOngoing: bySheet.reduce((a, s) => a + s.ongoing, 0),
  };
}

// ─── 다음주(월~금) 범위 ──────────────────────────────────────

function ymdToUtc(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
function addDaysYmd(ymd: string, n: number): string {
  const d = ymdToUtc(ymd);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 기준일(KST ymd)의 "다음주 월요일~금요일" 범위. 당주가 아닌 항상 다음 주. */
export function nextWeekdayRange(todayYmd: string): {
  startYmd: string;
  endYmd: string;
} {
  const dow = ymdToUtc(todayYmd).getUTCDay(); // 0=일 … 6=토
  const toMon = (1 - dow + 7) % 7 || 7; // 0(월)이면 7 → 다음 주 월
  const startYmd = addDaysYmd(todayYmd, toMon);
  return { startYmd, endYmd: addDaysYmd(startYmd, 4) };
}

// ─── 수시 준비 주차 목표 ─────────────────────────────────────

/** 4년제 수시 접수 시작일 — D-day 기준. 전문대도 같은 날 시작(9/30 종료). */
const SASI_APPLY_START_YMD = "2026-09-07";

type SasiWeek = {
  label: string;
  startYmd: string;
  endYmd: string;
  devTarget?: string;
  testTarget?: string;
  note?: string;
};

/**
 * 2026 수시 준비 주차별 목표 — 운영부 확정표.
 * 마지막 주차(9/4)를 넘기면 pickSasiGoal이 undefined를 돌려 섹션이 자동으로 사라진다.
 */
const SASI_WEEKS: SasiWeek[] = [
  { label: "7월 5주차", startYmd: "2026-07-27", endYmd: "2026-08-02", devTarget: "20%" },
  { label: "8월 1주차", startYmd: "2026-08-03", endYmd: "2026-08-09", devTarget: "50%", testTarget: "20%" },
  { label: "8월 2주차", startYmd: "2026-08-10", endYmd: "2026-08-16", devTarget: "70%", testTarget: "50%" },
  { label: "8월 3주차", startYmd: "2026-08-17", endYmd: "2026-08-23", devTarget: "100%", testTarget: "70%" },
  { label: "8월 4주차", startYmd: "2026-08-24", endYmd: "2026-08-30", testTarget: "100%" },
  { label: "9월 1주차", startYmd: "2026-08-31", endYmd: "2026-09-04", note: "최종 테스트 진행" },
];

export type SasiGoal = {
  label: string;
  /** "8/3~8/9" */
  rangeLabel: string;
  devTarget?: string;
  testTarget?: string;
  note?: string;
  /** 4년제 접수 시작까지 남은 일수 */
  dDay: number;
  /** "9/7(월)" */
  applyStartLabel: string;
};

/** "2026-08-03" → "8/3" (앞 0 제거) */
function mmddSlash(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}/${Number(d)}`;
}

function daysBetween(fromYmd: string, toYmd: string): number {
  const ms = ymdToUtc(toYmd).getTime() - ymdToUtc(fromYmd).getTime();
  return Math.round(ms / 86400000);
}

/**
 * 발행일이 속한 수시 주차 1건. 어느 주차에도 안 걸리면 undefined —
 * 시즌이 끝나면 섹션이 저절로 사라지므로 나중에 코드를 지우러 올 필요가 없다.
 */
export function pickSasiGoal(todayYmd: string): SasiGoal | undefined {
  const week = SASI_WEEKS.find(
    (w) => todayYmd >= w.startYmd && todayYmd <= w.endYmd,
  );
  if (!week) return undefined;
  return {
    label: week.label,
    rangeLabel: `${mmddSlash(week.startYmd)}~${mmddSlash(week.endYmd)}`,
    devTarget: week.devTarget,
    testTarget: week.testTarget,
    note: week.note,
    dDay: daysBetween(todayYmd, SASI_APPLY_START_YMD),
    applyStartLabel: "9/7(월)",
  };
}

// ─── 일정 그룹 ───────────────────────────────────────────────

export type BriefEvent = {
  type: string;
  title: string;
  start_at: string;
  end_at?: string | null;
  all_day: boolean;
};
export type ScheduleGroup = {
  type: string;
  label: string;
  items: BriefEvent[];
};

/** 일정 날짜 표기 — 단일일 "MM-DD", 다중일 "MM-DD~DD"(같은 달) 또는 "MM-DD~MM-DD". */
export function eventDateLabel(e: BriefEvent): string {
  const s = kstYmd(e.start_at);
  const en = e.end_at ? kstYmd(e.end_at) : "";
  if (!en || en === s) return s.slice(5);
  const sMMDD = s.slice(5);
  const eMMDD = en.slice(5);
  // 같은 달이면 뒤쪽은 일(DD)만
  return s.slice(0, 7) === en.slice(0, 7)
    ? `${sMMDD}~${eMMDD.slice(3)}`
    : `${sMMDD}~${eMMDD}`;
}

/** 일정 유형 표시 순서 + 한글 라벨 (schedule scheduleTypeSchema 기준). */
const SCHEDULE_TYPE_ORDER = [
  "shift",
  "application",
  "external_meeting",
  "training",
  "pims",
  "event",
  "leave",
] as const;
const SCHEDULE_TYPE_LABEL: Record<string, string> = {
  shift: "근무",
  application: "원서접수",
  external_meeting: "외부회의",
  training: "교육",
  pims: "PIMS",
  event: "일정",
  leave: "휴가",
};

/** ISO 시각 → KST(Asia/Seoul) YYYY-MM-DD. */
export function kstYmd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
}

/** [startYmd, endYmd] 범위(KST 날짜)의 일정을 유형별로 그룹. 빈 유형은 제외. */
export function groupScheduleInRange(
  events: BriefEvent[],
  startYmd: string,
  endYmd: string,
): ScheduleGroup[] {
  const inRange = events.filter((e) => {
    const ymd = kstYmd(e.start_at);
    return ymd >= startYmd && ymd <= endYmd;
  });
  const groups: ScheduleGroup[] = [];
  for (const type of SCHEDULE_TYPE_ORDER) {
    const items = inRange.filter((e) => e.type === type);
    if (items.length > 0)
      groups.push({ type, label: SCHEDULE_TYPE_LABEL[type] ?? type, items });
  }
  return groups;
}

// ─── HTML 빌더 ───────────────────────────────────────────────

/** 서비스 마감 임박 1건 — closing_services(결제마감 pay_end_at) 기준. */
export type ClosingItem = {
  university_name: string;
  service_name: string;
  pay_end_at: string;
  operator_name: string | null;
};

/** 마감(pay_end_at) KST 날짜별로 묶어 날짜 오름차순 반환. */
export function groupClosingByDate(
  closing: ClosingItem[],
): { date: string; items: ClosingItem[] }[] {
  const map = new Map<string, ClosingItem[]>();
  for (const c of closing) {
    const d = kstYmd(c.pay_end_at);
    const arr = map.get(d) ?? [];
    arr.push(c);
    map.set(d, arr);
  }
  return [...map.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
    .map(([date, items]) => ({ date, items }));
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// ─── AI 활용 (내 AI 작업 + TIP 공유) ────────────────────────

const AI_LIST_MAX = 3;

export type AiWorkBriefItem = {
  title: string;
  ai_tool: string;
  author_name: string;
  saved_hours: number | null;
};
export type AiWorkBrief = {
  count: number; // 이번 주 신규
  totalCount: number; // 누적
  savedHours: number;
  items: AiWorkBriefItem[];
  more: number;
};

/** 절감 시간 표기 — 정수는 그대로, 소수는 1자리 반올림 (예: 3 → "3", 1.25 → "1.3"). */
export function fmtHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/**
 * AI 작업 — 신규 건수·절감(신규 기준). 목록(items)은 최근 누적에서 최대 N건 채운다
 * (이번 주 신규가 0이어도 최근 작업이 보이도록). newRows=이번 주 신규, recentRows=최근순 누적.
 */
export function summarizeAiWork(
  newRows: AiWorkBriefItem[],
  recentRows: AiWorkBriefItem[],
  totalCount: number,
  maxItems = AI_LIST_MAX,
): AiWorkBrief {
  const items = recentRows.slice(0, maxItems);
  return {
    count: newRows.length,
    totalCount,
    savedHours: newRows.reduce((a, r) => a + (r.saved_hours ?? 0), 0),
    items,
    more: Math.max(0, totalCount - items.length),
  };
}

export type TipBriefItem = {
  title: string;
  ai_tool: string;
  author_name: string;
};
export type TipsBrief = {
  newCount: number;
  totalCount: number;
  items: TipBriefItem[];
  more: number;
};

/**
 * TIP — 신규/누적 건수. 목록(items)은 최근 누적에서 최대 N건 채운다
 * (이번 주 신규가 3건 미만이어도 최근 TIP이 보이도록). newRows=신규, recentRows=최근순 누적.
 */
export function summarizeTips(
  newRows: TipBriefItem[],
  recentRows: TipBriefItem[],
  totalCount: number,
  maxItems = AI_LIST_MAX,
): TipsBrief {
  const items = recentRows.slice(0, maxItems);
  return {
    newCount: newRows.length,
    totalCount,
    items,
    more: Math.max(0, totalCount - items.length),
  };
}

const INSIGHT_LIST_MAX = 3;

export type InsightBriefItem = {
  title: string;
  channel_title: string;
  view_count: number | null;
  url: string;
};
export type InsightsBrief = {
  newCount: number;
  items: InsightBriefItem[];
};

/** 조회수 표기 — 1만 미만 그대로, 이상은 만 단위 1자리(정수면 소수 생략). */
export function fmtViews(n: number): string {
  if (n < 10000) return String(n);
  const man = Math.round(n / 1000) / 10;
  return `${Number.isInteger(man) ? String(man) : man.toFixed(1)}만`;
}

/** 최근 7일 수집 인사이트 영상 — 랜덤 최대 N건(매 발행 다른 묶음) + 전체 신규 건수. */
export function summarizeInsights(
  rows: InsightBriefItem[],
  maxItems = INSIGHT_LIST_MAX,
): InsightsBrief {
  const shuffled = [...rows];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return { newCount: rows.length, items: shuffled.slice(0, maxItems) };
}

/** 완료율 = 완료 / (완료+진행중). 모수 0이면 "—". 소수 1자리. */
export function completionPct(done: number, ongoing: number): string {
  const total = done + ongoing;
  if (total === 0) return "—";
  return `${((done / total) * 100).toFixed(1)}%`;
}

/** 근속 기념일 — 발행 주 전후에 입사 기념일이 도래하는 운영자. */
export type Milestone = {
  name: string;
  years: number;
  dateYmd: string;
  isPast: boolean; // 발행일 이전(이미 지난 기념일)이면 true → 과거형 렌더
};

/**
 * 발행일 기준 [-lookbackDays, +windowDays] 창에 드는 입사 기념일(1주년 이상, 전체 연차).
 * 최근 지난 기념일(예: 며칠 전 만 1년)도 놓치지 않도록 과거 방향도 본다. 날짜 오름차순.
 */
export function upcomingAnniversaries(
  operators: { name: string; hired_at: string }[],
  todayYmd: string,
  windowDays = 14,
  lookbackDays = 14,
): Milestone[] {
  const startYmd = addDaysYmd(todayYmd, -lookbackDays);
  const limitYmd = addDaysYmd(todayYmd, windowDays);
  const todayYear = Number(todayYmd.slice(0, 4));
  const out: Milestone[] = [];
  for (const op of operators) {
    const hired = op.hired_at?.slice(0, 10);
    if (!hired || hired.length !== 10) continue;
    const hiredYear = Number(hired.slice(0, 4));
    const monthDay = hired.slice(5);
    // 연말/연초 경계까지 커버하도록 작년·올해·내년 기념일 후보를 본다.
    for (const y of [todayYear - 1, todayYear, todayYear + 1]) {
      const annivYmd = `${y}-${monthDay}`;
      const years = y - hiredYear;
      if (years < 1) continue;
      if (annivYmd >= startYmd && annivYmd <= limitYmd) {
        out.push({
          name: op.name,
          years,
          dateYmd: annivYmd,
          isPast: annivYmd < todayYmd,
        });
        break; // 한 명당 하나
      }
    }
  }
  return out.sort((a, b) =>
    a.dateYmd < b.dateYmd ? -1 : a.dateYmd > b.dateYmd ? 1 : 0,
  );
}

/** 생일 — 발행 주에 생일이 도래하는 운영자 (연도 무시, operators.birth_date). */
export type Birthday = { name: string; dateYmd: string };

/** 발행일부터 windowDays일 내 도래하는 생일. 올해분이 지났으면 내년으로. */
export function upcomingBirthdays(
  operators: { name: string; birth_date: string }[],
  todayYmd: string,
  windowDays = 14,
): Birthday[] {
  const limitYmd = addDaysYmd(todayYmd, windowDays);
  const todayYear = Number(todayYmd.slice(0, 4));
  const out: Birthday[] = [];
  for (const op of operators) {
    const birth = op.birth_date?.slice(0, 10);
    if (!birth || !/^\d{4}-\d{2}-\d{2}$/.test(birth)) continue;
    const monthDay = birth.slice(5);
    let ymd = `${todayYear}-${monthDay}`;
    if (ymd < todayYmd) ymd = `${todayYear + 1}-${monthDay}`;
    if (ymd >= todayYmd && ymd <= limitYmd)
      out.push({ name: op.name, dateYmd: ymd });
  }
  return out.sort((a, b) =>
    a.dateYmd < b.dateYmd ? -1 : a.dateYmd > b.dateYmd ? 1 : 0,
  );
}

/** 이번 주 기능 소개 — OPS Console 메뉴/기능을 매 호 하나씩 돌아가며 소개. */
export type FeatureIntro = { menu: string; title: string; desc: string };

/** 소개 카탈로그 — 호수별로 순환 노출. 새 기능 추가 시 여기 1줄. */
export const FEATURE_INTROS: FeatureIntro[] = [
  {
    menu: "서비스 > 인수인계",
    title: "서비스별 인수인계 + 메일 발송",
    desc: "14개 카테고리로 인수인계를 작성하고, 위저드에서 학교담당자에게 확인서(HTML) 첨부 메일까지 한 번에 보냅니다.",
  },
  {
    menu: "서비스 > 사고보고",
    title: "사고 등록부터 경위서 승인까지",
    desc: "운영 중 발생한 사고를 학년도·부서·상태로 모아 봅니다. 경위서를 붙여 승인 요청하면 승인대기·승인완료 상태가 목록에서 바로 보여, 어디까지 처리됐는지 찾아다닐 필요가 없어요.",
  },
  {
    menu: "개발 · AI > 개발/테스트 > 개발 탭",
    title: "원서제어 파일 분석",
    desc: "서비스별 원서제어(A.js·AU.js) 코드를 claude가 운영자 관점으로 요약해줍니다. 과거 학년도·마감일·하드코딩 전형코드 등 확인할 지점을 자동으로 짚어줘요.",
  },
  {
    menu: "고객응대 > 메일함",
    title: "메일함 위임",
    desc: "휴가 등으로 자리를 비울 때, 다른 운영자에게 본인 메일함 열람·회신 권한을 위임할 수 있어요. 발신 명의는 원래 담당자로 유지되고 실제 처리자는 별도로 기록됩니다.",
  },
  {
    menu: "이번 달 > 운영부 달력 · 서비스 > 백업 요청",
    title: "백업 요청 → 달력 자동 연동",
    desc: "백업 요청에 휴가유형을 넣으면 운영부 달력 상단에 '팀-이름-휴가유형'으로 자동 표기돼 팀 전체가 자리비움을 바로 인지합니다.",
  },
  {
    menu: "분석 · 보고 > 원서접수점검",
    title: "부서별 공유 링크 체크리스트",
    desc: "모집시기마다 작성 공유 링크 하나를 부서에 뿌리면, 로그인 없이 각 부서가 자기 항목을 작성·자동저장합니다. 임원 보고용 확인 링크는 별도예요.",
  },
  {
    menu: "AI & 자동화 > 자동화실행 · 미수채권",
    title: "미수 ↔ 입금 자동 매칭",
    desc: "매시간 미수채권과 입금내역을 대조해 단건·합산(N:1)까지 자동 매칭합니다. 담당자별 미수 알림 메일도 평일 아침 자동 발송돼요.",
  },
  {
    menu: "분석 · 보고 > 운영리포트",
    title: "기간별 KPI 리포트 + 공유",
    desc: "서비스·사고·계약·미수·인수인계·백업·메일·워크로그 8개 KPI를 기간별로 모아 봅니다. 공유 링크 생성·PDF 다운로드로 임원 보고도 간편해요.",
  },
  {
    menu: "AI & 자동화 > TIP 공유",
    title: "AI 활용 팁 · 재사용 프롬프트",
    desc: "운영부에서 통하는 AI 활용 팁과 그대로 복사해 쓰는 프롬프트를 모읍니다. 좋은 프롬프트를 발견하면 바로 공유해 주세요.",
  },
  {
    menu: "개요 > 운영부 뉴스",
    title: "대학 뉴스 자동 수집",
    desc: "대학 통폐합·폐교·정원감축 등 운영부 관련 뉴스를 매일 자동 수집해 최신순으로 모아 봅니다.",
  },
  {
    menu: "AI & 자동화 > 자동화실행",
    title: "경쟁률 세팅 점검 자동화",
    desc: "TEST 서버 경쟁률 세팅(스케줄·안내 문구·접수일정)을 대조해 어긋난 건을 담당 운영자 Teams 개인 채팅으로 알립니다. 합의된 정상 건은 예외로 등록해 알림에서 뺄 수 있어요.",
  },
  {
    menu: "서비스 > 백업 요청",
    title: "백업 요청 검색에 합격자통합관리 발표 서비스",
    desc: "백업 요청 서비스 검색에서 원서접수뿐 아니라 합격자통합관리시스템 발표 서비스도 함께 찾습니다. [원서]/[발표] 배지로 구분되고, 발표 서비스는 서비스목록에서 붙여넣기로 일괄등록해요.",
  },
];

/**
 * 소개 순환 기준점 — 이 호수에서 카탈로그 앞(인수인계·사고보고)부터 다시 시작한다.
 * 2호를 이 둘로 지정한 요청에 맞춘 앵커이며, 이후 호는 그 다음부터 perIssue건씩 이어간다.
 */
const FEATURE_ROTATION = { anchorIssueNo: 2, anchorCount: 2, perIssue: 3 };

/**
 * 호수별 기능 소개 지정 — title로 지정한다.
 *
 * 인덱스로 잡으면 카탈로그에 항목을 추가할 때 뒤 인덱스가 밀려 과거 핀이 조용히
 * 다른 기능을 가리킨다. title은 카탈로그 내 고유하고, 이 맵만 읽어도 어느 호에
 * 무엇을 실었는지 사람이 안다. 핀이 없는 호는 FEATURE_ROTATION 순환이 돈다.
 */
const FEATURE_PINS: Record<number, string[]> = {
  3: ["경쟁률 세팅 점검 자동화", "백업 요청 검색에 합격자통합관리 발표 서비스"],
};

/** 호수(1부터)로 소개 항목을 순환 선택 (매 호 서로 다른 묶음). */
export function pickFeatureIntros(
  issueNo: number,
  count?: number,
): FeatureIntro[] {
  const pinned = FEATURE_PINS[Math.max(1, Math.floor(issueNo))];
  if (pinned) {
    // title 오타로 발행이 깨지지 않게, 못 찾은 항목은 건너뛴다.
    const picked = pinned
      .map((t) => FEATURE_INTROS.find((f) => f.title === t))
      .filter((f): f is FeatureIntro => f !== undefined);
    if (picked.length > 0) return picked.slice(0, count ?? picked.length);
  }

  const len = FEATURE_INTROS.length;
  const n = Math.max(1, Math.floor(issueNo));
  const { anchorIssueNo, anchorCount, perIssue } = FEATURE_ROTATION;
  const sinceAnchor = Math.max(0, n - anchorIssueNo);
  const take = Math.min(
    Math.max(1, count ?? (sinceAnchor === 0 ? anchorCount : perIssue)),
    len,
  );
  // 앵커 호 이전이거나 앵커 호면 카탈로그 앞부터, 이후면 앵커가 소비한 만큼 건너뛴 지점부터.
  const start =
    sinceAnchor === 0 ? 0 : (anchorCount + (sinceAnchor - 1) * perIssue) % len;
  const out: FeatureIntro[] = [];
  for (let i = 0; i < take; i++) out.push(FEATURE_INTROS[(start + i) % len]);
  return out;
}

/** 기념일 1건의 고유 키 — 종류+이름+날짜. 같은 사람의 다른 해 기념일은 다른 키. */
export function celebrationKey(
  kind: "ms" | "bd",
  name: string,
  dateYmd: string,
): string {
  return `${kind}:${name}:${dateYmd}`;
}

/**
 * 이미 발행된 호에 실린 기념일을 걸러낸다.
 * 윈도우가 [-14, +14]로 넓어 주간 발행 시 같은 기념일이 여러 호에 겹쳐 나오던 문제를 막는다.
 * 윈도우를 좁히지 않으므로 발행을 한 주 건너뛰어도 기념일이 누락되지 않는다.
 */
export function excludeSeenCelebrations<
  T extends { name: string; dateYmd: string },
>(items: T[], kind: "ms" | "bd", seen: Set<string>): T[] {
  return items.filter((i) => !seen.has(celebrationKey(kind, i.name, i.dateYmd)));
}

/** 뉴스레터 사진/영상 — Supabase Storage 공개 URL + 캡션(원 파일명 유래). */
export type BriefingMedia = { src: string; caption?: string };
export type BriefingImages = {
  cover?: BriefingMedia;
  gallery?: BriefingMedia[];
  videos?: BriefingMedia[];
};

/**
 * 앨범 노출 상한 — 커버 1장을 포함한 총 장수.
 * 주간 업로드(10~15장)를 자르지 않으면서, 실수로 대량 업로드된 경우의 폭주만 막는다.
 * 코멘트(story.album)는 업로드된 캡션 전체를 보고 쓰므로, 상한이 낮으면
 * 글에는 언급됐는데 사진은 없는 불일치가 생긴다.
 */
export const ALBUM_MAX = 20;
/** 영상 노출 상한 — 용량이 커 본문 무게를 좌우한다. */
export const ALBUM_VIDEO_MAX = 2;

/** 수집된 사진·영상 → 뉴스레터에 실을 커버/앨범/영상. 둘 다 없으면 undefined. */
export function pickAlbum(
  gallery: BriefingMedia[],
  videos: BriefingMedia[],
): BriefingImages | undefined {
  if (gallery.length === 0 && videos.length === 0) return undefined;
  return {
    cover: gallery[0],
    gallery: gallery.slice(1, ALBUM_MAX),
    videos: videos.slice(0, ALBUM_VIDEO_MAX),
  };
}

/** claude -p가 생성하는 뉴스레터 스토리 — 캐치 제목 + 인트로 + 섹션별 이야기. */
export type BriefingStory = {
  headline: string;
  /** Teams 티저용 낚시 한 줄('운영부 마법사' 페르소나·자극적). 없으면 기본 문구. */
  teaser?: string;
  intro: string;
  sections: {
    contracts: string;
    schedule: string;
    closing: string;
    ai: string;
    /** 기념일 코멘트 — 구 발행분에는 없어 optional. */
    celebration?: string;
    /** 기능 소개 코멘트 — 구 발행분에는 없어 optional. */
    features?: string;
    /** 사진·영상 코멘트 — 구 발행분에는 없어 optional. */
    album?: string;
  };
};

/** 뉴스레터 페이지(/r/briefing/[token])가 렌더할 브리핑 구조화 payload. */
export type BriefingPayload = {
  dateLabel: string;
  contracts: ContractSummary;
  weekRange: { startYmd: string; endYmd: string };
  schedule: ScheduleGroup[];
  closing: ClosingItem[];
  aiWork: AiWorkBrief;
  tips: TipsBrief;
  insights: InsightsBrief;
  /** 근속 마일스톤 (발행 주 도래분) — 구버전 발행분은 없음 */
  milestones?: Milestone[];
  /** 생일 (발행 주 도래분, 연도 무시) */
  birthdays?: Birthday[];
  /** 이번 주 기능 소개 (호수별 순환, 3개 내외) — 구버전 발행분은 없음 */
  featureIntros?: FeatureIntro[];
  /** 사진·영상 (Supabase Storage newsletter 버킷 최근 업로드분) */
  images?: BriefingImages;
  /** claude -p 생성 스토리 — 없으면 페이지가 수치 중심으로 렌더 */
  story?: BriefingStory;
  /** 수시 준비 주차 목표 — 시즌 밖이면 없음 */
  sasiGoal?: SasiGoal;
};

/**
 * Teams 티저 메시지 HTML — 제호(호수·날짜) + 핵심 수치 요약 + 뉴스레터 링크.
 * 상세 내용은 뉴스레터 웹페이지가 렌더한다 (Teams 채팅은 스타일 제한).
 */
export function buildBriefingTeaserHtml(input: {
  issueNo: number;
  dateLabel: string;
  /** claude -p 생성 캐치 제목 — 있으면 첫 줄, 제호는 둘째 줄로 */
  headline?: string;
  /** claude -p 생성 낚시 티저(페르소나·자극적) — 없으면 기본 호기심 문구 */
  teaser?: string;
  contracts: ContractSummary;
  closing: ClosingItem[];
  aiWork: AiWorkBrief;
  tips: TipsBrief;
  url: string;
}): string {
  const {
    issueNo,
    dateLabel,
    headline,
    teaser,
    contracts,
    closing,
    aiWork,
    tips,
    url,
  } = input;
  const issue = `#${String(issueNo).padStart(3, "0")}`; // 뉴스레터와 동일 3자리
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const savedSuffix =
    aiWork.savedHours > 0 ? `(절감 ${fmtHours(aiWork.savedHours)}h)` : "";
  const lines: string[] = [];
  if (headline) {
    lines.push(`<b>📰 ${escapeHtml(headline)}</b>`);
    lines.push(`<br/>운영부 주간 브리핑 ${issue} · ${escapeHtml(dateLabel)}`);
  } else {
    lines.push(
      `<b>📰 [운영부 주간 브리핑] ${issue} · ${escapeHtml(dateLabel)}</b>`,
    );
  }
  lines.push(
    `<br/><br/>👀 ${escapeHtml(teaser || "이번 주 운영부, 무슨 일이 있었을까요?")}`,
  );
  lines.push(
    `<br/>계약 총 ${totalAll} · 완료 ${contracts.totalDone} · 진행중 ${contracts.totalOngoing} (완료 ${completionPct(contracts.totalDone, contracts.totalOngoing)})`,
  );
  lines.push(
    `<br/>마감 임박 ${closing.length}건 · AI 작업 ${aiWork.count}건${savedSuffix} · 신규 TIP ${tips.newCount}건`,
  );
  lines.push(
    `<br/><br/><b>👉 <a href="${escapeHtml(url)}">지금 뉴스레터에서 전체 이야기 확인하기 →</a></b>`,
  );
  return lines.join("");
}
