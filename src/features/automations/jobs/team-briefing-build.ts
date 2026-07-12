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
function completionPct(done: number, ongoing: number): string {
  const total = done + ongoing;
  if (total === 0) return "—";
  return `${((done / total) * 100).toFixed(1)}%`;
}

/** 문자열 표시폭(half-unit) — 한글/전각=2, 그 외=1. 프로포셔널 폰트라 근사치. */
function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const wide = /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦　-〿]/.test(ch);
    w += wide ? 2 : 1;
  }
  return w;
}

/** text 의 셀 폭(한글=2)만큼 전각 대시(―)를 채워 합계 줄 끝(닫는 괄호)까지 닿는 구분선. */
function ruleFor(text: string): string {
  return "―".repeat(Math.max(12, displayWidth(text)));
}

/** 팀 보고 브리핑 Teams 메시지 HTML(contentType: html) — 차주 업무 → 계약(누적) → AI 활용 순. */
export function buildBriefingHtml(input: {
  dateLabel: string;
  contracts: ContractSummary;
  weekRange: { startYmd: string; endYmd: string };
  schedule: ScheduleGroup[];
  closing: ClosingItem[];
  aiWork: AiWorkBrief;
  tips: TipsBrief;
  insights: InsightsBrief;
}): string {
  const {
    dateLabel,
    contracts,
    weekRange,
    schedule,
    closing,
    aiWork,
    tips,
    insights,
  } = input;
  const lines: string[] = [];
  lines.push(`<b>[팀 보고 브리핑] ${escapeHtml(dateLabel)}</b>`);

  // 1. 계약진행 현황 (누적)
  lines.push("<br/><br/><b>■ 계약현황 (누적)</b>");
  for (const s of contracts.bySheet) {
    lines.push(
      `<br/>· ${escapeHtml(s.sheet)}: 총 ${s.done + s.ongoing} · 완료 ${s.done} · 진행중 ${s.ongoing} (완료 ${completionPct(s.done, s.ongoing)})`,
    );
  }
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const totalLine = `합계: 총 ${totalAll} · 완료 ${contracts.totalDone} · 진행중 ${contracts.totalOngoing} (완료 ${completionPct(contracts.totalDone, contracts.totalOngoing)})`;
  // 구분선도 합계 라인과 동일하게 볼드 — 비볼드면 폭이 좁아 닫는 괄호에 못 미침
  lines.push(`<br/><b>${ruleFor(totalLine)}</b>`);
  lines.push(`<br/><b>${totalLine}</b>`);

  // 2. 차주 팀 업무 — 일정 + 서비스 마감. 주간 범위는 섹션 헤더에.
  lines.push(
    `<br/><br/><b>■ 차주 팀 업무 (${weekRange.startYmd} ~ ${weekRange.endYmd})</b>`,
  );
  lines.push("<br/><b>· 일정</b>");
  if (schedule.length === 0) {
    lines.push("<br/>&nbsp;&nbsp;예정된 일정 없음");
  } else {
    for (const g of schedule) {
      const titles = g.items
        .map((i) => `${escapeHtml(i.title)}(${eventDateLabel(i)})`)
        .join(", ");
      lines.push(`<br/>&nbsp;&nbsp;[${escapeHtml(g.label)}] ${titles}`);
    }
  }

  // 서비스 마감 — 앞에 빈 줄로 일정과 구분.
  lines.push(
    `<br/><br/><b>· 서비스 마감 (7일 내 · 총 ${closing.length}건)</b>`,
  );
  if (closing.length === 0) {
    lines.push("<br/>&nbsp;&nbsp;임박 마감 없음");
  } else {
    // 마감일별 그룹 — 날짜 헤더(건수) + 그 아래 대학·서비스·담당자.
    // 그룹당 최대 10건 표시, 10건 초과 시 헤더 "10건+ (전체 N건)" · 앞 10건만 노출.
    for (const g of groupClosingByDate(closing)) {
      const shown = g.items.slice(0, 10);
      const countLabel =
        g.items.length > 10
          ? `10건+ (전체 ${g.items.length}건)`
          : `${g.items.length}건`;
      lines.push(`<br/>&nbsp;&nbsp;<b>[${g.date.slice(5)}] ${countLabel}</b>`);
      for (const u of shown) {
        const op = u.operator_name ? ` (${escapeHtml(u.operator_name)})` : "";
        lines.push(
          `<br/>&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(u.university_name)} ${escapeHtml(u.service_name)}${op}`,
        );
      }
    }
  }

  // 3. AI 활용 — 내 AI 작업(my-ai-work) + TIP 공유(ai-tips), 최근 7일.
  lines.push("<br/><br/><b>■ AI 활용 (최근 7일)</b>");
  const savedSuffix =
    aiWork.savedHours > 0 ? ` · 절감 ${fmtHours(aiWork.savedHours)}h` : "";
  lines.push(`<br/><b>· 내 AI 작업 ${aiWork.count}건${savedSuffix}</b>`);
  if (aiWork.count === 0) {
    lines.push("<br/>&nbsp;&nbsp;등록된 AI 작업 없음");
  } else {
    for (const w of aiWork.items) {
      const hours =
        w.saved_hours != null ? ` · ${fmtHours(w.saved_hours)}h` : "";
      lines.push(
        `<br/>&nbsp;&nbsp;${escapeHtml(w.title)} (${escapeHtml(w.ai_tool)} · ${escapeHtml(w.author_name)}${hours})`,
      );
    }
    if (aiWork.more > 0) lines.push(`<br/>&nbsp;&nbsp;외 ${aiWork.more}건`);
  }

  lines.push(
    `<br/><br/><b>· TIP 공유 (신규 ${tips.newCount} · 누적 ${tips.totalCount})</b>`,
  );
  if (tips.newCount === 0) {
    lines.push("<br/>&nbsp;&nbsp;신규 TIP 없음");
  } else {
    for (const t of tips.items) {
      lines.push(
        `<br/>&nbsp;&nbsp;${escapeHtml(t.title)} (${escapeHtml(t.ai_tool)} · ${escapeHtml(t.author_name)})`,
      );
    }
    if (tips.more > 0) lines.push(`<br/>&nbsp;&nbsp;외 ${tips.more}건`);
  }

  // 인사이트 — 최근 7일 수집 영상 중 조회수 상위만 노출.
  lines.push(
    `<br/><br/><b>· AI 인사이트 (신규 수집 ${insights.newCount}건)</b>`,
  );
  if (insights.newCount === 0) {
    lines.push("<br/>&nbsp;&nbsp;신규 수집 영상 없음");
  } else {
    for (const v of insights.items) {
      const views =
        v.view_count != null ? ` · 조회 ${fmtViews(v.view_count)}` : "";
      lines.push(
        `<br/>&nbsp;&nbsp;<a href="${escapeHtml(v.url)}">${escapeHtml(v.title)}</a> (${escapeHtml(v.channel_title)}${views})`,
      );
    }
  }

  return lines.join("");
}
