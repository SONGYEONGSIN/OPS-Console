import { academicYearRangeKST } from "@/features/closing/academic-year";
import { workKey, type WorkloadSpan, type WorkloadWindows } from "./workload";

/**
 * 건수 원천을 `대학|업무종류` 로 옮긴다 — 순수 함수다(설계 §6.2, PR5 에서 실측 정정).
 *
 * **원천은 `closing_services` 하나다.** §6.2 는 원서접수를 `services` 에서 센다고
 * 적었지만 그 표는 구글 시트 임포트가 2026-02-28 에서 멈춰 있어(2511행 전부
 * `google_sheet_import`) 지금 학년도 창에 **0건**이다. 그대로 쓰면 전원의 건수·
 * 밀도·주월연이 0 이 되고, 그건 '일이 없다' 로 읽힌다. 살아 있는 미러는
 * `closing_services` 이고 창 안 969건/286곳 — §6.2 가 적은 **286곳과 같다**.
 *
 * `operator_name` 은 여전히 안 본다(낡은 스냅샷, §1). 담당자는 원장에서 오고
 * 여기서는 **대학 이름으로만** 센다.
 */

/** 기계값용 KST 날짜. `academic-year.ts` 가 같은 이유로 `en-CA` 를 직접 쓴다. */
const KST_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const kstDay = (iso: string) => KST_DAY.format(new Date(iso));

export type ClosingRow = {
  university_name: string;
  category: string | null;
  write_start_at: string;
  write_end_at: string;
};

export type AnnouncementRow = { university_name: string };

/**
 * `closing_services.category` → 업무종류. **목록이 아니라 포함 검사**다 —
 * 실측 구분이 `대학원`·`대학원 전기`·`대학원 후기`·`법학전문대학원 가나`·
 * `법학전문대학원 나군` 다섯이고, 목록으로 적으면 여섯 번째가 생기는 날
 * 조용히 원서접수 담당자의 부하로 붙는다.
 */
export function workKindOfClosing(category: string | null): string {
  return (category ?? "").includes("대학원") ? "대학원" : "원서접수";
}

/**
 * 건수 맵. **없는 조합에 0 을 넣지 않는다** — 키가 없어야 `buildWorkload` 가
 * '못 센 칸' 으로 세고, 성적산출 44곳·상담앱 25곳이 부하 0 으로 읽히지 않는다.
 */
export function buildServiceCounts(input: {
  closing: readonly ClosingRow[];
  announcement: readonly AnnouncementRow[];
}): Record<string, number> {
  const counts: Record<string, number> = {};
  const bump = (key: string) => {
    counts[key] = (counts[key] ?? 0) + 1;
  };

  for (const r of input.closing) {
    bump(workKey({ ...r, work_kind: workKindOfClosing(r.category) }));
  }
  for (const r of input.announcement) {
    bump(workKey({ ...r, work_kind: "PIMS" }));
  }
  return counts;
}

/** 주·월·연 진행 구간. 창과 문자열로 견주므로 **KST 날짜**로 내린다. */
export function buildSpans(rows: readonly ClosingRow[]): WorkloadSpan[] {
  return rows.map((r) => ({
    university_name: r.university_name,
    work_kind: workKindOfClosing(r.category),
    start: kstDay(r.write_start_at),
    end: kstDay(r.write_end_at),
  }));
}

/** KST 요일(0=일). `en-US` 짧은 요일로 읽는다 — 로캘이 흔들리지 않는 값이다. */
const KST_WEEKDAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  weekday: "short",
});
const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** `YYYY-MM-DD` 에 일수를 더한다. 문자열끼리 견주는 창이라 문자열로 돌려준다. */
const shiftDay = (day: string, delta: number) => {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

/**
 * 주·월·연 창(양끝 포함).
 *
 * **주는 월요일 시작**이다 — 접수 오픈이 월요일에 몰려서 일요일 시작으로 두면
 * 같은 주의 오픈이 두 주로 갈린다. **연은 `academicYearRangeKST` 가 정한다**:
 * 여기서 다시 정의하면 마감 스크랩과 배분현황이 서로 다른 해를 보면서 둘 다
 * '올해' 라고 적어, 어긋나도 아무도 못 알아챈다.
 */
export function workloadWindows(now: Date): WorkloadWindows {
  const today = kstDay(now.toISOString());
  // 일요일(0)은 그 주의 **끝**이라 6일 앞이 월요일이다.
  const weekday = WEEKDAY_INDEX[KST_WEEKDAY.format(now)];
  const monday = shiftDay(today, weekday === 0 ? -6 : 1 - weekday);

  const monthStart = `${today.slice(0, 7)}-01`;
  const monthEnd = shiftDay(`${shiftDay(monthStart, 31).slice(0, 7)}-01`, -1);

  const { start, end } = academicYearRangeKST(now);
  return {
    week: [monday, shiftDay(monday, 6)],
    month: [monthStart, monthEnd],
    year: [start.date, end.date],
  };
}
