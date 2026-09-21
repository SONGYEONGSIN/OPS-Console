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

/**
 * KST 날짜 `YYYY-MM-DD`. 구간과 창을 **문자열로** 견주므로 오늘도 같은 형식이어야
 * 한다 — 신규배정의 '아직 시작 전' 판정이 이 값을 쓴다.
 */
export const kstDay = (iso: string) => KST_DAY.format(new Date(iso));

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
 * 물량으로 세지 않는 대학.
 *
 * `진학대학교` 는 **테스트 대학**이다 — 2027학년도 마감 15건이 `엔터 결제 테스트`·
 * `웹 모의해킹 테스트1/2`·`기획 테스트용` 이다(실측 2026-09-21). 원장에 없는 것이
 * 맞고, 물량으로 세면 목표·편차가 있지도 않은 일로 부풀려진다.
 */
const NON_WORKLOAD_UNIVERSITIES: ReadonlySet<string> = new Set(["진학대학교"]);

/**
 * 마감의 대학명 끝에 붙은 **대학원 표기**. ` 대학원` · `(대학원)` · ` 경영전문대학원`
 * 셋 다 같은 모양이라 하나로 잡는다.
 *
 * 괄호 안 캠퍼스(`동국대학교(서울) 대학원`)는 앞에 있어 안 걸린다 — 동국대는 서울과
 * WISE 가 다른 담당이라 그걸 지우면 엉뚱한 사람에게 붙는다.
 */
const GRADUATE_SUFFIX = /[\s(]+[가-힣]*대학원\s*\)?$/;

/**
 * 건수를 붙일 때 쓰는 **대학 이름**.
 *
 * `category` 가 이미 `대학원 전기`·`대학원 후기` 라고 말하므로(→ `work_kind`), 마감의
 * 이름 끝에 또 붙은 `대학원` 은 **중복된 정보**다. 별칭을 추측해 잇는 것이 아니라
 * 겹친 것을 떼는 것이라, 설계 F1 이 막으려던 일과 다르다.
 *
 * **원장은 건드리지 않는다.** 배정리스트가 정본이고, 마감은 미러라 그쪽 표기를
 * 원장 쪽으로 맞춘다. 이게 없으면 `성균관대학교 대학원` 32건이 원장
 * `성균관대학교` 담당자에게 안 붙는다 — 실측으로 마감 983건 중 **231건(23.5%)** 이
 * 아무에게도 안 붙어 있었고 그중 179건이 이 한 모양이었다.
 */
export function canonicalUniversity(
  universityName: string,
  workKind: string,
): string {
  if (workKind !== "대학원") return universityName;
  const stripped = universityName.replace(GRADUATE_SUFFIX, "").trim();
  // 떼면 아무것도 안 남는 이름(`대학원`)은 그대로 둔다 — 빈 키는 전부를 한 칸에 모은다.
  return stripped === "" ? universityName : stripped;
}

/**
 * 한 줄을 건수·구간·담당 칸이 쓰는 (대학, 업무종류) 로 옮긴다.
 *
 * **셋이 같은 답을 봐야 한다.** 한 곳만 정규화하면 키가 어긋나고, 그건 에러가 아니라
 * '그 사람은 아무것도 안 맡았다' 로 화면에 나온다.
 */
function cellOf(row: { university_name: string; category: string | null }) {
  const work_kind = workKindOfClosing(row.category);
  return {
    university_name: canonicalUniversity(row.university_name, work_kind),
    work_kind,
  };
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
    if (NON_WORKLOAD_UNIVERSITIES.has(r.university_name)) continue;
    bump(workKey(cellOf(r)));
  }
  for (const r of input.announcement) {
    if (NON_WORKLOAD_UNIVERSITIES.has(r.university_name)) continue;
    bump(workKey({ ...r, work_kind: "PIMS" }));
  }
  return counts;
}

export type UnmatchedVolume = {
  /** 안 붙은 서비스 건수. */
  services: number;
  /** 그 건수가 걸린 (대학 × 업무종류) 수. */
  keys: number;
};

/**
 * 어느 담당자에게도 **안 붙은** 건수.
 *
 * 지금까지 조용히 빠져 있었다 — 배분현황 줄의 합이 원천 건수보다 적은데 화면에
 * 그 사실이 없어서, 물량의 23.5%가 사라진 것을 아무도 못 봤다(실측 2026-09-21).
 * 0 이 아니면 이름이 갈렸거나 배정 시트에 없는 대학이라는 뜻이다.
 *
 * **주소가 없는 칸은 담당자가 아니다.** 이름만 있는 칸에 건수를 붙이면 그 건수가
 * 누구의 부하인지 말할 수 없으면서 합계만 맞아 보인다.
 */
export function unmatchedVolume(
  serviceCounts: Readonly<Record<string, number>>,
  cells: readonly WorkloadCell[],
): UnmatchedVolume {
  const held = new Set(
    cells.filter((c) => c.assignee_email !== null).map(workKey),
  );
  let services = 0;
  let keys = 0;
  for (const [key, n] of Object.entries(serviceCounts)) {
    if (held.has(key)) continue;
    services += n;
    keys += 1;
  }
  return { services, keys };
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
    if (NON_WORKLOAD_UNIVERSITIES.has(r.university_name)) continue;
    /*
     * **건수와 같은 이름으로 접는다.** 과거 학년도는 담당자도 건수도 `services`
     * 한 표에서 나오는데, 한쪽만 정규화하면 담당자 키는 `충남대학교 대학원`,
     * 건수 키는 `충남대학교` 가 되어 서로 안 만난다 — 화면에서는 그 사람이 그 해
     * 아무것도 안 맡은 것처럼 보인다.
     */
    const cell: WorkloadCell = { ...cellOf(r), assignee_email: email };
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
  return rows
    .filter((r) => !NON_WORKLOAD_UNIVERSITIES.has(r.university_name))
    .map((r) => ({
      // 건수와 **같은 이름·같은 업무종류**로 옮긴다. 갈리면 표의 건수와 상세 목록이
      // 서로 다른 대학을 가리키고, 둘 다 멀쩡해 보인다.
      ...cellOf(r),
      service_name: r.service_name,
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
