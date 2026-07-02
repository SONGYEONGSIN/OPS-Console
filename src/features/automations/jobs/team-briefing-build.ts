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

/** 팀 보고 브리핑 Teams 메시지 HTML(contentType: html). */
export function buildBriefingHtml(input: {
  dateLabel: string;
  contracts: ContractSummary;
  weekRange: { startYmd: string; endYmd: string };
  schedule: ScheduleGroup[];
  closing: ClosingItem[];
}): string {
  const { dateLabel, contracts, weekRange, schedule, closing } = input;
  const lines: string[] = [];
  lines.push(`<b>[팀 보고 브리핑] ${escapeHtml(dateLabel)}</b>`);

  // 1. 계약진행 현황
  lines.push("<br/><br/><b>■ 계약현황</b>");
  for (const s of contracts.bySheet) {
    lines.push(
      `<br/>· ${escapeHtml(s.sheet)}: 총 ${s.done + s.ongoing} · 완료 ${s.done} · 진행중 ${s.ongoing} (완료 ${completionPct(s.done, s.ongoing)})`,
    );
  }
  const totalAll = contracts.totalDone + contracts.totalOngoing;
  const totalLine = `합계: 총 ${totalAll} · 완료 ${contracts.totalDone} · 진행중 ${contracts.totalOngoing} (완료 ${completionPct(contracts.totalDone, contracts.totalOngoing)})`;
  lines.push(`<br/>${ruleFor(totalLine)}`);
  lines.push(`<br/><b>${totalLine}</b>`);

  // 2. 팀업무 현황
  lines.push("<br/><br/><b>■ 팀업무 현황</b>");
  lines.push(
    `<br/><b>· 다음주 일정 (${weekRange.startYmd} ~ ${weekRange.endYmd})</b>`,
  );
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

  lines.push(`<br/><b>· 서비스 마감 (7일 내) · 총 ${closing.length}건</b>`);
  if (closing.length === 0) {
    lines.push("<br/>&nbsp;&nbsp;임박 마감 없음");
  } else {
    // 마감일별 그룹 — 날짜 헤더(건수) + 그 아래 대학·서비스·담당자.
    for (const g of groupClosingByDate(closing)) {
      lines.push(
        `<br/>&nbsp;&nbsp;<b>[${g.date.slice(5)}] ${g.items.length}건</b>`,
      );
      for (const u of g.items) {
        const op = u.operator_name ? ` (${escapeHtml(u.operator_name)})` : "";
        lines.push(
          `<br/>&nbsp;&nbsp;&nbsp;&nbsp;${escapeHtml(u.university_name)} ${escapeHtml(u.service_name)}${op}`,
        );
      }
    }
  }

  return lines.join("");
}
