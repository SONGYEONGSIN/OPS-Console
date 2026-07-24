/**
 * 팀 보고 브리핑 — 순수 집계·메시지 빌더 (외부 의존 없음, 단위 테스트 대상).
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

const AI_LIST_MAX = 5;

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
    menu: "서비스 > 인수인계",
    title: "서비스별 인수인계 + 메일/PDF",
    desc: "14개 카테고리로 인수인계를 작성하고, 위저드에서 학교담당자에게 PDF 첨부 메일까지 한 번에 보냅니다.",
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
];

/** 호수(1부터)로 소개 항목을 count개 순환 선택 (매 호 서로 다른 묶음). */
export function pickFeatureIntros(issueNo: number, count = 3): FeatureIntro[] {
  const len = FEATURE_INTROS.length;
  const n = Math.max(1, Math.floor(issueNo));
  const take = Math.min(Math.max(1, count), len);
  const start = ((n - 1) * take) % len;
  const out: FeatureIntro[] = [];
  for (let i = 0; i < take; i++) out.push(FEATURE_INTROS[(start + i) % len]);
  return out;
}

/** 뉴스레터 사진/영상 — Supabase Storage 공개 URL + 캡션(원 파일명 유래). */
export type BriefingMedia = { src: string; caption?: string };
export type BriefingImages = {
  cover?: BriefingMedia;
  gallery?: BriefingMedia[];
  videos?: BriefingMedia[];
};

/** claude -p가 생성하는 뉴스레터 스토리 — 캐치 제목 + 인트로 + 섹션별 이야기. */
export type BriefingStory = {
  headline: string;
  intro: string;
  sections: {
    contracts: string;
    schedule: string;
    closing: string;
    ai: string;
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
    contracts,
    closing,
    aiWork,
    tips,
    url,
  } = input;
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const savedSuffix =
    aiWork.savedHours > 0 ? `(절감 ${fmtHours(aiWork.savedHours)}h)` : "";
  const lines: string[] = [];
  if (headline) {
    lines.push(`<b>📰 ${escapeHtml(headline)}</b>`);
    lines.push(
      `<br/>운영부 주간 브리핑 #${issueNo} · ${escapeHtml(dateLabel)}`,
    );
  } else {
    lines.push(
      `<b>📰 [운영부 주간 브리핑] #${issueNo} · ${escapeHtml(dateLabel)}</b>`,
    );
  }
  lines.push(`<br/><br/>👀 이번 주 운영부, 무슨 일이 있었을까요?`);
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
