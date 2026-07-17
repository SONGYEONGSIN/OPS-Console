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
  count: number;
  savedHours: number;
  items: AiWorkBriefItem[];
  more: number;
};

/** 절감 시간 표기 — 정수는 그대로, 소수는 1자리 반올림 (예: 3 → "3", 1.25 → "1.3"). */
export function fmtHours(h: number): string {
  const r = Math.round(h * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** 최근 7일 내 AI 작업 — 건수·절감시간 합계(null 제외) + 앞 N건 목록. */
export function summarizeAiWork(
  rows: AiWorkBriefItem[],
  maxItems = AI_LIST_MAX,
): AiWorkBrief {
  return {
    count: rows.length,
    savedHours: rows.reduce((a, r) => a + (r.saved_hours ?? 0), 0),
    items: rows.slice(0, maxItems),
    more: Math.max(0, rows.length - maxItems),
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

/** 최근 7일 신규 TIP 목록 + 누적 건수. */
export function summarizeTips(
  newRows: TipBriefItem[],
  totalCount: number,
  maxItems = AI_LIST_MAX,
): TipsBrief {
  return {
    newCount: newRows.length,
    totalCount,
    items: newRows.slice(0, maxItems),
    more: Math.max(0, newRows.length - maxItems),
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

/** 최근 7일 수집 인사이트 영상 — 조회수 상위 N건(null은 뒤로) + 전체 신규 건수. */
export function summarizeInsights(
  rows: InsightBriefItem[],
  maxItems = INSIGHT_LIST_MAX,
): InsightsBrief {
  const sorted = [...rows].sort(
    (a, b) => (b.view_count ?? -1) - (a.view_count ?? -1),
  );
  return { newCount: rows.length, items: sorted.slice(0, maxItems) };
}

/** 완료율 = 완료 / (완료+진행중). 모수 0이면 "—". 소수 1자리. */
export function completionPct(done: number, ongoing: number): string {
  const total = done + ongoing;
  if (total === 0) return "—";
  return `${((done / total) * 100).toFixed(1)}%`;
}

/** 근속 마일스톤 — 발행 주에 입사 기념일이 도래하는 운영자. */
export type Milestone = { name: string; years: number; dateYmd: string };

/**
 * 발행일부터 windowDays일 내 도래하는 입사 기념일(1주년 이상).
 * 올해 기념일이 지났으면 내년 날짜로 계산. 날짜 오름차순.
 */
export function upcomingAnniversaries(
  operators: { name: string; hired_at: string }[],
  todayYmd: string,
  windowDays = 7,
): Milestone[] {
  const limitYmd = addDaysYmd(todayYmd, windowDays);
  const todayYear = Number(todayYmd.slice(0, 4));
  const out: Milestone[] = [];
  for (const op of operators) {
    const hired = op.hired_at?.slice(0, 10);
    if (!hired || hired.length !== 10) continue;
    const hiredYear = Number(hired.slice(0, 4));
    const monthDay = hired.slice(5);
    let annivYmd = `${todayYear}-${monthDay}`;
    if (annivYmd < todayYmd) annivYmd = `${todayYear + 1}-${monthDay}`;
    const years = Number(annivYmd.slice(0, 4)) - hiredYear;
    if (years < 1) continue;
    if (annivYmd >= todayYmd && annivYmd <= limitYmd) {
      out.push({ name: op.name, years, dateYmd: annivYmd });
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
  windowDays = 7,
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
    if (ymd >= todayYmd && ymd <= limitYmd) out.push({ name: op.name, dateYmd: ymd });
  }
  return out.sort((a, b) =>
    a.dateYmd < b.dateYmd ? -1 : a.dateYmd > b.dateYmd ? 1 : 0,
  );
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
  const { issueNo, dateLabel, headline, contracts, closing, aiWork, tips, url } =
    input;
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
  lines.push(
    `<br/>계약 총 ${totalAll} · 완료 ${contracts.totalDone} · 진행중 ${contracts.totalOngoing} (완료 ${completionPct(contracts.totalDone, contracts.totalOngoing)})`,
  );
  lines.push(
    `<br/>마감 임박 ${closing.length}건 · AI 작업 ${aiWork.count}건${savedSuffix} · 신규 TIP ${tips.newCount}건`,
  );
  lines.push(
    `<br/><br/><a href="${escapeHtml(url)}">👉 뉴스레터 전체 보기</a>`,
  );
  return lines.join("");
}
