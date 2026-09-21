import { academicYearRangeKST } from "@/features/closing/academic-year";
import {
  workKey,
  type WorkloadCell,
  type WorkloadSpan,
  type WorkloadWindows,
} from "./workload";

/**
 * 건수 원천을 `대학|업무종류` 로 옮긴다 — 순수 함수다(설계 §6.2, PR5 에서 실측 정정).
 *
 * **원천은 학년도로 갈린다**(2026-09-21 라이브 실측):
 *
 *   2026학년도(작년)  `services` 2,511건/313곳  ↔ `closing_services`     2건/1곳
 *   2027학년도(올해)  `services`     0건/0곳    ↔ `closing_services`   983건/286곳
 *
 * `services` 는 구글 시트 임포트가 2026-02-28 에서 멈춘 표이고(2511행 전부
 * `google_sheet_import`), `closing_services` 는 살아 있는 마감 미러다. 그래서
 * **올해는 마감, 작년은 서비스목록**에서 읽는다 — 한쪽만 읽으면 올해가 0 이 되거나
 * 작년 비교가 통째로 불가능해지고, 둘 다 '일이 없다' 로 읽힌다.
 *
 * 두 표는 여기서 쓰는 칸(`university_name`·`service_name`·`category`·
 * `write_start_at`·`write_end_at`)의 모양이 같아 한 타입으로 받는다.
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

/** `closing_services`(올해) · `services`(작년) 공통으로 읽는 칸. */
export type ClosingRow = {
  university_name: string;
  /** 상세 리스트에 적는 이름. 실데이터가 "2027학년도 수시모집" 형태의 완성 문장이다. */
  service_name: string;
  category: string | null;
  write_start_at: string;
  write_end_at: string;
};

export type AnnouncementRow = { university_name: string };

/** `services` 에서 과거 학년도 담당자를 만들 때 읽는 칸. */
export type PastServiceRow = {
  university_name: string;
  category: string | null;
  operator_email: string | null;
};

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

/**
 * 과거 학년도 담당 칸 — **원장에는 그 해 행이 없다.**
 *
 * `assignments` 는 현재 학년도만 담고(2027학년도 1,858행), 2026학년도 담당자는
 * `services.operator_email` 에 있다(실측 2026-09-21: 2,485/2,511 = 99.0% 채움,
 * 배정 대상 15명 전원 연결). 건수 원천만 바꾸고 담당자를 안 바꾸면 **과거 연도
 * 표에서 전원이 0곳**이 되고, 그건 화면에서 '그 해엔 아무도 안 맡았다' 로 읽힌다.
 *
 * 업무종류를 `workKindOfClosing` 으로 가르는 것은 **건수와 같은 규칙을 써야**
 * 하기 때문이다 — 다르게 가르면 `workKey` 가 어긋나 그 사람의 건수가 0 이 된다.
 * 라이브 실측으로 `services.category` 도 같은 '대학원 포함' 규약을 쓴다(2026학년도
 * 740건 / 2027학년도 404건).
 *
 * 자연키로 접는다. 대학 수를 세는 단위가 **대학**이라, 안 접으면 한 사람이 같은
 * 대학을 여러 번 맡은 것처럼 보인다.
 */
export function pastCells(rows: readonly PastServiceRow[]): WorkloadCell[] {
  const byKey = new Map<string, WorkloadCell>();
  for (const r of rows) {
    const email = (r.operator_email ?? "").trim();
    if (email === "") continue;
    const cell: WorkloadCell = {
      university_name: r.university_name,
      work_kind: workKindOfClosing(r.category),
      assignee_email: email,
    };
    byKey.set(`${workKey(cell)}|${email}`, cell);
  }
  return [...byKey.values()];
}

/**
 * 주·월·연 진행 구간. 창과 문자열로 견주므로 **KST 날짜**로 내린다.
 *
 * 서비스명을 함께 싣는다 — 배분현황이 '이번 주 3건' 에서 멈추면 어느 대학의
 * 무엇인지 볼 곳이 없어 모니터링이 성립하지 않는다.
 */
export function buildSpans(rows: readonly ClosingRow[]): WorkloadSpan[] {
  return rows.map((r) => ({
    university_name: r.university_name,
    service_name: r.service_name,
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
