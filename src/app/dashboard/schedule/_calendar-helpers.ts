import type {
  ScheduleEventRow,
  ScheduleType,
} from "@/features/schedule/schemas";
import type { ServicesRow } from "@/features/services/schemas";
import type { BackupRequestRow } from "@/features/backup-requests/schemas";
import type { PaymentDate } from "@/features/payment-dates/schemas";

export type CalendarCategory =
  | "service-start"
  | "service-end"
  | "backup-leave"
  | "payment-personal"
  | "payment-shared"
  | ScheduleType; // shift / event / leave / training

export type CalendarSourceVariant =
  "schedule" | "services" | "backup" | "payment";

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
  rowRef: ScheduleEventRow | ServicesRow | BackupRequestRow | PaymentDate;
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

/**
 * 멀티데이 펼침 시 주말(토·일) 셀을 제외하는 일정 유형 — 연차/교육 등 근무일 기반.
 * 입시·행사·원서접수(application/pims/event 등)는 주말에도 진행되므로 주말에도 표기한다.
 */
const WEEKEND_SKIP_TYPES = new Set<ScheduleType>(["leave", "training"]);

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
  paymentDates: PaymentDate[] = [],
): Map<string, CalendarItem[]> {
  const map = new Map<string, CalendarItem[]>();

  const push = (ymd: string, item: CalendarItem) => {
    const list = map.get(ymd);
    if (list) list.push(item);
    else map.set(ymd, [item]);
  };

  // 백업요청으로 등록된 (날짜 → 이름들). 백업 휴가 렌더와 동일 규칙(평일만)으로 펼친다.
  // 같은 날 같은 사람이 백업요청 등록돼 있으면 중복되는 schedule leave 이벤트를 숨긴다.
  const backupNamesByDay = new Map<string, string[]>();
  for (const lv of backupLeaves) {
    if (!lv.startYmd || !lv.name) continue;
    const bEnd =
      lv.endYmd && lv.endYmd >= lv.startYmd ? lv.endYmd : lv.startYmd;
    let bCur = lv.startYmd;
    let bGuard = 0;
    while (bCur <= bEnd && bGuard < MAX_LEAVE_SPAN_DAYS) {
      const dow = ymdWeekday(bCur);
      if (dow !== 0 && dow !== 6) {
        const list = backupNamesByDay.get(bCur);
        if (list) list.push(lv.name);
        else backupNamesByDay.set(bCur, [lv.name]);
      }
      bCur = ymdAddDays(bCur, 1);
      bGuard++;
    }
  }
  // 해당 날짜에 백업요청 이름이 title에 포함된 연차(leave) 이벤트 = 중복 → 백업요청만 남기고 숨김.
  const isBackupDupLeave = (type: ScheduleType, title: string, ymd: string) =>
    type === "leave" &&
    (backupNamesByDay.get(ymd)?.some((n) => title.includes(n)) ?? false);

  for (const e of events) {
    const startYmd = toKstYmd(e.start_at);
    const isTeamCommon = !e.assignee_email;
    const endYmd = e.end_at ? toKstYmd(e.end_at) : startYmd;
    const isMultiDay = endYmd !== startYmd;

    // 단일일 일정: 주말이어도 그대로 표기(특정일 이벤트).
    if (!isMultiDay) {
      if (isBackupDupLeave(e.type, e.title, startYmd)) continue;
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
      continue;
    }

    // 멀티데이 일정: 시작~종료 모든 날짜에 펼친다. 연차·교육(WEEKEND_SKIP_TYPES)만 주말(토·일) 제외 —
    // 입시·행사·원서접수 등은 주말에도 진행되므로 표기 유지.
    // 시작일=시작 시각 sortKey, 종료일=종료 시각, 중간일=""(진행중 = all_day 최상단). rowRef는 동일 event.
    const skipWeekend = WEEKEND_SKIP_TYPES.has(e.type);
    let cur = startYmd;
    let guard = 0;
    while (cur <= endYmd && guard < MAX_LEAVE_SPAN_DAYS) {
      const dow = ymdWeekday(cur);
      if (
        !(skipWeekend && (dow === 0 || dow === 6)) &&
        !isBackupDupLeave(e.type, e.title, cur)
      ) {
        const isStart = cur === startYmd;
        const isEnd = cur === endYmd;
        push(cur, {
          id: isStart ? e.id : isEnd ? `${e.id}::end` : `${e.id}::${cur}`,
          ymd: cur,
          category: e.type,
          label: e.title,
          sortKey: isStart
            ? toKstSortKey(e.start_at, e.all_day)
            : isEnd
              ? toKstSortKey(e.end_at as string, e.all_day)
              : "",
          all_day: e.all_day,
          sourceVariant: "schedule",
          isTeamCommon,
          rowRef: e,
        });
      }
      cur = ymdAddDays(cur, 1);
      guard++;
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

  // 비용지급일 — 개인/공용을 해당 날짜 셀에 all_day 칩으로. 읽기전용(Excel 원본), 전사 공통.
  for (let i = 0; i < paymentDates.length; i++) {
    const pd = paymentDates[i];
    const category: CalendarCategory = pd.category.includes("개인")
      ? "payment-personal"
      : "payment-shared";
    push(pd.ymd, {
      id: `payment-${pd.ymd}-${i}`,
      ymd: pd.ymd,
      category,
      label: `${pd.category}비용`,
      sortKey: "",
      all_day: true,
      sourceVariant: "payment",
      rowRef: pd,
    });
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
