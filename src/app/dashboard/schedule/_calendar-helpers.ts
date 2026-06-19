import type {
  ScheduleEventRow,
  ScheduleType,
} from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import type { BackupRequestRow } from "@/features/backup-requests/schemas";

export type CalendarCategory =
  | "service-start"
  | "service-end"
  | "backup-leave"
  | ScheduleType; // shift / event / leave / training

export type CalendarSourceVariant = "schedule" | "services" | "backup";

export type CalendarItem = {
  id: string;
  ymd: string;
  category: CalendarCategory;
  label: string;
  /** 정렬 키: all_day=true는 그대로 "", false면 시작 시각 KST HH:mm */
  sortKey: string;
  all_day: boolean;
  sourceVariant: CalendarSourceVariant;
  /** schedule_event 중 assignee_email=null (팀 공통). 정렬·강조(★ + bold)용 */
  isTeamCommon?: boolean;
  /** Inspector에 전달할 원본 row (variant에 따라 분기) */
  rowRef: ScheduleEventRow | ServicesRow | BackupRequestRow;
};

/**
 * 백업 요청 휴가유형의 달력 표기 입력 — page에서 requester_email을 운영자 이름으로,
 * requester_team을 팀명으로 미리 해석해 전달한다.
 */
export type BackupLeaveInput = {
  id: string;
  team: string | null;
  name: string;
  leaveType: string;
  /** YYYY-MM-DD */
  startYmd: string;
  /** YYYY-MM-DD, null이면 시작일 하루만 */
  endYmd: string | null;
  rowRef: BackupRequestRow;
};

/** 멀티데이 휴가 펼침 상한 — 비정상 범위로 인한 폭주 방지 */
const MAX_LEAVE_SPAN_DAYS = 366;

/** "YYYY-MM-DD"에 일수를 더한 새 "YYYY-MM-DD" (타임존 무관 — 달력상 자연일) */
function ymdAddDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** YMD의 요일 (0=일 ~ 6=토). UTC 기준 — 날짜 자체의 요일이라 tz 무관. */
function ymdWeekday(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type CalendarCell = {
  /** KST 기준 자정의 Date (정렬·비교 용) */
  date: Date;
  /** KST YYYY-MM-DD */
  ymd: string;
  /** 표시 월에 속하는지 (전/익월이면 false) */
  inMonth: boolean;
};

const YMD_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const TIME_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function toKstYmd(iso: string): string {
  return YMD_FORMATTER.format(new Date(iso));
}

function toKstSortKey(iso: string, allDay: boolean): string {
  if (allDay) return "";
  // 24h HH:mm — 정렬에 그대로 사용 가능
  return TIME_FORMATTER.format(new Date(iso));
}

/**
 * 주어진 month의 1일 KST 기준으로 직전 일요일부터 시작하는 42셀(6주) 그리드를 만든다.
 * 일관성을 위해 6주 고정 — 다음달 일부 셀이 포함될 수 있다.
 */
export function buildMonthGrid(year: number, month0: number): CalendarCell[] {
  // UTC noon을 앵커로 — 어떤 시간대에서도 정오는 같은 calendar day.
  // KST(UTC+9) 기준 정오 UTC = 21시 KST이지만, 날짜는 동일.
  const firstNoonUtc = new Date(Date.UTC(year, month0, 1, 12));
  const dow = firstNoonUtc.getUTCDay(); // 0=일

  const cells: CalendarCell[] = [];
  for (let i = 0; i < 42; i++) {
    const offset = i - dow;
    const d = new Date(Date.UTC(year, month0, 1 + offset, 12));
    const ymd = YMD_FORMATTER.format(d);
    const month0OfCell = Number(ymd.slice(5, 7)) - 1;
    cells.push({
      date: d,
      ymd,
      inMonth: month0OfCell === month0,
    });
  }
  return cells;
}

/**
 * "내 일정" 모드 가시성 필터.
 *
 * mineActive=false 또는 myEmail 없음이면 전체 반환. mineActive면 본인(담당자 또는 생성자) 일정에 더해
 * **팀 공통(담당자 없음, !assignee_email)** 일정도 포함한다 — 팀 공통은 누가 만들었든 전원에게 보여야
 * 하므로 내 일정 모드에서도 노출. (남이 만든 개인 일정만 가려진다.)
 */
export function filterVisibleScheduleEvents(
  events: ScheduleEventRow[],
  opts: { mineActive: boolean; myEmail: string | null },
): ScheduleEventRow[] {
  const { mineActive, myEmail } = opts;
  if (!mineActive || !myEmail) return events;
  return events.filter(
    (e) =>
      !e.assignee_email || // 팀 공통(담당자 없음) — 전원 노출
      e.assignee_email === myEmail ||
      e.created_by_email === myEmail,
  );
}

export function groupItemsByDay(
  events: ScheduleEventRow[],
  services: ServicesRow[],
  backupLeaves: BackupLeaveInput[] = [],
): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();

  const push = (ymd: string, item: CalendarItem) => {
    const list = map.get(ymd);
    if (list) list.push(item);
    else map.set(ymd, [item]);
  };

  for (const e of events) {
    const startYmd = toKstYmd(e.start_at);
    const isTeamCommon = !e.assignee_email;
    push(startYmd, {
      id: e.id,
      ymd: startYmd,
      category: e.type,
      label: e.title,
      sortKey: toKstSortKey(e.start_at, e.all_day),
      all_day: e.all_day,
      sourceVariant: "schedule",
      isTeamCommon,
      rowRef: e,
    });
    // 멀티데이 일정: 종료일이 시작일과 다르면 종료 ymd에도 push (services 패턴 정합).
    // rowRef는 동일 event라 두 셀에서 인스펙터 열어도 같은 row 표시.
    if (e.end_at) {
      const endYmd = toKstYmd(e.end_at);
      if (endYmd !== startYmd) {
        push(endYmd, {
          id: `${e.id}::end`,
          ymd: endYmd,
          category: e.type,
          label: e.title,
          sortKey: toKstSortKey(e.end_at, e.all_day),
          all_day: e.all_day,
          sourceVariant: "schedule",
          isTeamCommon,
          rowRef: e,
        });
      }
    }
  }

  for (const s of services) {
    // 라벨에 대학명 prefix → 대학·서비스 식별 명확
    const svcLabel = `${s.university_name} — ${s.service_name}`;
    if (s.write_start_at) {
      const ymd = toKstYmd(s.write_start_at);
      push(ymd, {
        id: `${s.id}::start`,
        ymd,
        category: "service-start",
        label: svcLabel,
        sortKey: "",
        all_day: true,
        sourceVariant: "services",
        rowRef: s,
      });
    }
    if (s.write_end_at) {
      const ymd = toKstYmd(s.write_end_at);
      push(ymd, {
        id: `${s.id}::end`,
        ymd,
        category: "service-end",
        label: svcLabel,
        sortKey: "",
        all_day: true,
        sourceVariant: "services",
        rowRef: s,
      });
    }
  }

  // 백업 요청 휴가유형 — 시작~종료 모든 날짜에 "팀-이름-휴가유형" 라벨로 펼친다.
  for (const lv of backupLeaves) {
    if (!lv.startYmd) continue;
    const label = [lv.team, lv.name, lv.leaveType].filter(Boolean).join("-");
    const endYmd =
      lv.endYmd && lv.endYmd >= lv.startYmd ? lv.endYmd : lv.startYmd;
    let cur = lv.startYmd;
    let guard = 0;
    while (cur <= endYmd && guard < MAX_LEAVE_SPAN_DAYS) {
      // 주말(토=6, 일=0)은 휴가 표기 제외 — 평일만 셀에 표시.
      const dow = ymdWeekday(cur);
      if (dow !== 0 && dow !== 6) {
        push(cur, {
          id: `${lv.id}::${cur}`,
          ymd: cur,
          category: "backup-leave",
          label,
          sortKey: "",
          all_day: true,
          sourceVariant: "backup",
          rowRef: lv.rowRef,
        });
      }
      cur = ymdAddDays(cur, 1);
      guard++;
    }
  }

  // 셀별 정렬: 백업휴가 → 팀공통 → all_day → sortKey asc (안정 정렬)
  // 백업휴가/팀공통(전원 영향)을 최상단에 노출해 운영자가 즉시 인지하도록.
  for (const list of map.values()) {
    list.sort((a, b) => {
      const aBackup = a.sourceVariant === "backup";
      const bBackup = b.sourceVariant === "backup";
      if (aBackup !== bBackup) return aBackup ? -1 : 1;
      if (!!a.isTeamCommon !== !!b.isTeamCommon) return a.isTeamCommon ? -1 : 1;
      if (a.all_day !== b.all_day) return a.all_day ? -1 : 1;
      return a.sortKey.localeCompare(b.sortKey);
    });
  }

  return map;
}
