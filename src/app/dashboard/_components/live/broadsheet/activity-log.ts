import type { WorklogRow } from "@/features/worklog/schemas";

/** 타임라인 점·로그 색 톤 (worklog level 파생). */
export type ActivityTone = "info" | "warn" | "err" | "debug";

/** 시각이 보존된 활동 로그 1건 — 가로 타임라인 + 시스템 로그 패널 공용. */
export type ActivityLogEntry = {
  id: string;
  atIso: string;
  /** KST "HH:MM:SS" */
  hms: string;
  /** KST 자정 기준 분(分). 0–1439. 타임라인 x 위치 계산용. */
  minutesOfDay: number;
  /** 대문자 도메인 태그 (예: "NAV"). */
  domain: string;
  /** 표시 텍스트 — user_name 있으면 "{이름} · {msg}". */
  text: string;
  tone: ActivityTone;
};

/** 업무 시간대 — 09:00 ~ 18:00 (분 단위). */
export const WINDOW_START_MIN = 9 * 60;
export const WINDOW_END_MIN = 18 * 60;

const KST_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function levelToTone(level: WorklogRow["level"]): ActivityTone {
  if (level === "ERROR") return "err";
  if (level === "WARN") return "warn";
  if (level === "DEBUG") return "debug";
  return "info";
}

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** ISO 문자열 → KST 날짜 "YYYY-MM-DD". */
export function kstDateYmd(iso: string): string {
  return KST_DATE.format(new Date(iso));
}

/** ISO 문자열 → KST {hms, minutesOfDay}. */
export function kstClock(iso: string): { hms: string; minutesOfDay: number } {
  const parts = KST_PARTS.formatToParts(new Date(iso));
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === t)?.value ?? "00";
  const h = Number(get("hour"));
  const m = Number(get("minute"));
  const s = get("second");
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return { hms: `${hh}:${mm}:${s}`, minutesOfDay: h * 60 + m };
}

/** worklog 행(DESC, 최신 first) → 활동 로그 엔트리(입력 순서 보존). */
export function buildActivityLog(rows: WorklogRow[]): ActivityLogEntry[] {
  return rows.map((r, i) => {
    const { hms, minutesOfDay } = kstClock(r.created_at);
    const who = r.user_name ? `${r.user_name} · ` : "";
    return {
      id: r.id ?? `wl-${i}`,
      atIso: r.created_at,
      hms,
      minutesOfDay,
      domain: r.domain.toUpperCase(),
      text: `${who}${r.msg}`,
      tone: levelToTone(r.level),
    };
  });
}

/** 분(分) → 타임라인 x 비율(0–100). 업무 시간대 밖은 0/100으로 clamp. */
export function timelinePercent(minutesOfDay: number): number {
  const span = WINDOW_END_MIN - WINDOW_START_MIN;
  const pct = ((minutesOfDay - WINDOW_START_MIN) / span) * 100;
  return Math.min(100, Math.max(0, pct));
}

/** 09:00–18:00 사이(포함) 여부. */
export function isInWindow(minutesOfDay: number): boolean {
  return minutesOfDay >= WINDOW_START_MIN && minutesOfDay <= WINDOW_END_MIN;
}

/** 로그 도메인 태그 색 (시스템 로그 패널). 미정의 도메인은 muted. */
export function logDomainClass(domain: string): string {
  const map: Record<string, string> = {
    INCIDENTS: "text-vermilion",
    INCIDENT: "text-vermilion",
    NAV: "text-gold",
    CONTRACTS: "text-sage",
    CONTRACT: "text-sage",
    BACKUP: "text-indigo",
    "BACKUP-REQUESTS": "text-indigo",
    SERVICES: "text-muted",
    HANDOVER: "text-gold",
    SCHEDULE: "text-amber",
    DEPLOY: "text-amber",
    SYS: "text-muted",
    CRON: "text-amber",
  };
  return map[domain] ?? "text-muted";
}

/** 타임라인 점 색 (tone 기준). */
export function timelineDotClass(tone: ActivityTone): string {
  if (tone === "err") return "bg-vermilion";
  if (tone === "warn") return "bg-amber";
  return "bg-ink";
}

/** 타임라인 라벨 겹침 방지를 위한 최소 이벤트 간격(분). */
export const TIMELINE_MIN_GAP_MIN = 45;

/**
 * 타임라인에 표시할 이벤트 — 업무시간 내 + 시각 오름차순.
 * 동시각 군집(일괄 작업 등)으로 라벨이 겹치지 않도록, 직전 선택 대비
 * TIMELINE_MIN_GAP_MIN 이상 떨어진 건만 그리디 선택하고 max건으로 제한.
 */
export function selectTimelineEvents(
  entries: ActivityLogEntry[],
  max = 6,
): ActivityLogEntry[] {
  const sorted = entries
    .filter((e) => isInWindow(e.minutesOfDay))
    .sort((a, b) => a.minutesOfDay - b.minutesOfDay);

  const picked: ActivityLogEntry[] = [];
  for (const e of sorted) {
    if (picked.length >= max) break;
    const last = picked[picked.length - 1];
    if (!last || e.minutesOfDay - last.minutesOfDay >= TIMELINE_MIN_GAP_MIN) {
      picked.push(e);
    }
  }
  return picked;
}

/** 근접 이벤트 그룹 — 대표(lead) + 멤버 전체. 라벨 "(+N)" 표시·팝오버용. */
export type TimelineGroup = {
  /** 대표(그룹 첫 이벤트, 가장 이른 건). */
  lead: ActivityLogEntry;
  /** 대표 포함 그룹 전체. */
  members: ActivityLogEntry[];
  /** 대표 기준 타임라인 위치(분). */
  minutesOfDay: number;
};

/**
 * 타임라인 이벤트 그룹화 — 업무시간 내 + 시각 오름차순.
 * 직전 그룹 대표와 gapMin 미만이면 같은 그룹으로 흡수(버리지 않음),
 * 충분히 떨어지면 새 그룹. 그룹 수는 maxGroups로 제한.
 */
export function groupTimelineEvents(
  entries: ActivityLogEntry[],
  maxGroups = 6,
  gapMin = TIMELINE_MIN_GAP_MIN,
): TimelineGroup[] {
  const sorted = entries
    .filter((e) => isInWindow(e.minutesOfDay))
    .sort((a, b) => a.minutesOfDay - b.minutesOfDay);
  const groups: TimelineGroup[] = [];
  for (const e of sorted) {
    const last = groups[groups.length - 1];
    if (last && e.minutesOfDay - last.minutesOfDay < gapMin) {
      last.members.push(e);
    } else {
      if (groups.length >= maxGroups) break;
      groups.push({ lead: e, members: [e], minutesOfDay: e.minutesOfDay });
    }
  }
  return groups;
}

const KST_HMS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Date → KST 자정 기준 경과 초(0–86399). */
export function kstSecondsOfDay(date: Date): number {
  const parts = KST_HMS.formatToParts(date);
  const get = (t: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === t)?.value ?? 0);
  return get("hour") * 3600 + get("minute") * 60 + get("second");
}

/**
 * 퇴근(18:00 KST)까지 남은 시간 "H:MM:SS". 업무 시작(09:00) 전에는 최대 9:00:00로
 * cap(09–18 업무창 기준). 18:00 이후엔 빈 문자열.
 */
export function leaveCountdown(date: Date): string {
  const toEnd = WINDOW_END_MIN * 60 - kstSecondsOfDay(date);
  const workdaySec = (WINDOW_END_MIN - WINDOW_START_MIN) * 60; // 9h
  const remain = Math.min(toEnd, workdaySec);
  if (toEnd <= 0) return "";
  const hh = Math.floor(remain / 3600);
  const mm = Math.floor((remain % 3600) / 60);
  const ss = remain % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${hh}:${pad(mm)}:${pad(ss)}`;
}
