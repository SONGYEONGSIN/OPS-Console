import { TENURE_GROUPS, careerStartOf } from "./tenure";
import { deviation } from "./proposal/objective";

/**
 * 배분현황 집계 — **§6.1 의 근거를 사람이 검산하는 자리**(설계 §9.4).
 *
 * 부하 지표 셋 중 둘만 독립이다: `svc = univ × dens` 라 건수는 결과값이고, 목표는
 * `(대학 수, 밀도)` 둘로 잡는다. 그리고 **그룹 안에서만** 견준다 — 한효진(17곳/91건/
 * 5.4)과 김승현(29곳/48건/1.7)의 차이는 연차에 따라 의도된 것이라, 전체를 균등화하면
 * 그 차이를 지우려 든다(§3.5).
 *
 * 순수 함수다. 학년도로 자르는 것도(`academicYearRangeKST`), 세 원천에서 건수를 세는
 * 것도(§6.2) 쿼리의 일이다 — 여기는 이미 잘린 값을 받는다.
 */

export type WorkloadOperator = {
  email: string;
  name: string;
  /**
   * `operators.tenure_group`. 사람이 넣는 값이라 비어 있을 수 있고, 스키마가
   * `nullable().optional()` 이라 **`undefined` 로도 온다** — 둘 다 미설정이다.
   */
  tenure_group?: string | null;
  /** `operators.assignable`. 팀장·부장·이사·기획팀·테스트 계정이 false 다(§3.4). */
  assignable: boolean;
  hired_at: string;
  /** 재입사자는 `hired_at` 이 최근이라 배정 근거는 이쪽이다(`careerStartOf`). */
  career_start_at?: string | null;
};

/** 학년도로 이미 잘린 원장 칸. 대학 수를 세는 단위는 **대학**이지 칸이 아니다. */
export type WorkloadCell = {
  university_name: string;
  work_kind: string;
  assignee_email: string | null;
};

/** `write_start_at ~ write_end_at`. 주·월·연 진행을 겹침으로 센다. */
export type WorkloadSpan = {
  university_name: string;
  /** 상세 리스트에 적는 이름. 집계에는 안 쓰지만 같은 조회에서 따라온다. */
  service_name: string;
  work_kind: string;
  start: string;
  end: string;
};

/** 각 창은 `[시작, 끝]` 이고 **양끝을 포함**한다. */
export type WorkloadWindows = {
  week: [string, string];
  month: [string, string];
  year: [string, string];
};

/**
 * 이번 달에 도는 서비스 한 줄 — **'이번 주 3건' 에서 멈추면 모니터링이 아니다.**
 *
 * 주 창을 벗어난 것도 남긴다(`inWeek: false`). 빼면 '이번 달 5건' 의 내역이
 * 3건만 보여 머리 숫자와 목록이 어긋난다.
 */
export type WorkloadRunning = {
  university_name: string;
  service_name: string;
  work_kind: string;
  start: string;
  end: string;
  inWeek: boolean;
};

export type WorkloadRow = {
  email: string;
  name: string;
  /** `careerStartOf` 가 고른 날. 햇수로 바꾸는 것은 화면의 일이다. */
  careerStart: string;
  universities: number;
  /**
   * 담당 대학 이름(가나다순). **검색을 위해 든다** — 배정현황의 줄은 사람이라,
   * 대학으로 찾으려면 그 줄이 어느 대학을 들고 있는지 알아야 한다.
   *
   * `running` 으로 대신할 수 없다: 그쪽은 **이번 달에 도는 것**뿐이라 12월 서비스만
   * 있는 대학은 9월에 검색해도 안 나오고, 그게 '안 맡았다' 와 구분되지 않는다.
   */
  universityNames: string[];
  services: number;
  /** 대학당 서비스 수. 담당 대학이 없으면 0 이다 — 0 으로 나누지 않는다. */
  density: number;
  /**
   * 건수를 **못 센** 칸 수(원천에 그 조합이 없다). `services` 의 0 과 갈라 적어야
   * 한다 — 안 그러면 '일이 없다' 와 '못 본다' 가 화면에서 같아진다.
   */
  uncounted: number;
  week: number;
  month: number;
  year: number;
  /** §6.1 의 `dev(op)`. 그룹 목표가 없으면 `null`. */
  deviation: number | null;
  /** 이번 달에 도는 서비스 목록(시작일 순). `month` 의 내역이다. */
  running: WorkloadRunning[];
};

export type WorkloadGroup = {
  /** 연차 그룹. 미설정자는 `그룹 미설정` 으로 묶인다. */
  group: string;
  /** 그룹 안 평균. 미설정 묶음은 `null` — 목표가 될 수 없다. */
  target: { universities: number; density: number } | null;
  rows: WorkloadRow[];
};

/**
 * 상단 KPI 의 값. **전원 기준이라 검색과 무관하다** — 검색으로 좁힌 줄로 내면
 * 한 사람을 찾을 때 '배정 대상 1명' 이 되어, 요약이 요약을 그만둔다.
 */
export type WorkloadSummary = {
  people: number;
  /** **distinct** 대학. 실측 286곳 중 44곳이 업무종류별로 둘에게 갈려 있어, 사람별 대학 수를 더하면 그 44곳이 두 번 세어진다. */
  universities: number;
  /**
   * 그 학년도 **원천 총량**. 사람별 건수를 더한 값이 아니다.
   *
   * 하위유형이 갈린 대학은 한 `대학|업무종류` 를 둘이 나눠 맡는데(수시는 A, 정시는
   * B) 건수 키에는 하위유형이 없어 **양쪽 모두에게 전량이 붙는다**. 실측 2026-09-22:
   * 그런 키가 36개라 사람별 합 1,307 이 원천 1,112 보다 210건 컸다.
   *
   * 총량이라 `안 붙음` 카드와 **분모가 같다** — 1,112 중 15건이 안 붙었다고 읽힌다.
   * 사람별 합을 쓰면 두 카드가 서로 다른 모집단을 말한다.
   */
  services: number;
};

export function summarizeWorkload(
  groups: readonly WorkloadGroup[],
  serviceCounts: Readonly<Record<string, number>>,
): WorkloadSummary {
  const rows = groups.flatMap((g) => g.rows);
  const univs = new Set(rows.flatMap((r) => r.universityNames));
  return {
    people: rows.length,
    universities: univs.size,
    services: Object.values(serviceCounts).reduce((sum, n) => sum + n, 0),
  };
}

/** 그룹을 못 정한 사람들의 자리. 목표를 내지 않지만 **표에서 빼지는 않는다.** */
export const UNSET_GROUP = "그룹 미설정";

/**
 * 건수·구간이 붙는 단위의 키. **건수를 세는 쪽과 받는 쪽이 같은 함수를 써야 한다** —
 * 한쪽이 `대학-업무` 로 잇는 순간 전원의 건수가 0 이 되고, 그건 '아직 안 맡았다'
 * 와 화면에서 구분이 안 된다.
 */
export const workKey = (v: { university_name: string; work_kind: string }) =>
  `${v.university_name}|${v.work_kind}`;

/** 구간이 창과 **겹치는가**. 창 안에 통째로 들어가야 하는 것이 아니다. */
const overlaps = (span: WorkloadSpan, [from, to]: [string, string]) =>
  span.start <= to && span.end >= from;

const mean = (values: number[]) =>
  values.reduce((a, b) => a + b, 0) / values.length;

export function buildWorkload(input: {
  operators: readonly WorkloadOperator[];
  cells: readonly WorkloadCell[];
  /**
   * `대학명|업무종류` → 서비스 건수(§6.2 의 세 원천). 없는 조합은 0 으로 센다.
   *
   * **대학 단위로 세면 안 된다** — 286곳 중 44곳이 업무종류별로 다른 사람에게
   * 갈려 있어(§3.1), 대학으로 세면 남의 PIMS 건수가 원서접수 담당자에게 붙는다.
   */
  serviceCounts: Readonly<Record<string, number>>;
  spans: readonly WorkloadSpan[];
  windows: WorkloadWindows;
  /**
   * 그룹 목표·편차를 낼 것인가. **과거 학년도에는 `false`** 다.
   *
   * `operators.tenure_group` 은 오늘의 값 하나뿐이라, 작년 숫자에 오늘 그룹을
   * 씌우면 그때 존재한 적 없는 목표가 나오고 그 목표 대비 편차는 틀린 숫자다.
   * 그룹은 묶음 이름으로만 남는다.
   */
  targets?: boolean;
}): WorkloadGroup[] {
  const { cells, serviceCounts, spans, windows } = input;
  const targets = input.targets ?? true;

  // C1 — 배정 대상만 본다. 팀장·이사·테스트 계정이 섞이면 그룹 평균이 흔들린다.
  const operators = input.operators.filter((o) => o.assignable);
  const known = new Set(operators.map((o) => o.email));

  /**
   * 운영자 → 담당 범위. 두 단위를 함께 든다 — 건수·진행 구간은 `대학|업무종류`
   * 로 붙고, 대학 수는 **대학**으로 센다(한 대학의 수시·정시를 다 맡아도 한 곳).
   */
  const scopeByOperator = new Map<
    string,
    { keys: Set<string>; univs: Set<string> }
  >();
  for (const c of cells) {
    // 이메일이 없거나 배정 대상 밖이면 누구의 것도 아니다.
    if (!c.assignee_email || !known.has(c.assignee_email)) continue;
    const scope = scopeByOperator.get(c.assignee_email) ?? {
      keys: new Set<string>(),
      univs: new Set<string>(),
    };
    scope.keys.add(workKey(c));
    scope.univs.add(c.university_name);
    scopeByOperator.set(c.assignee_email, scope);
  }

  const rowOf = (o: WorkloadOperator): WorkloadRow => {
    const { keys, univs } = scopeByOperator.get(o.email) ?? {
      keys: new Set<string>(),
      univs: new Set<string>(),
    };
    // 건수를 모르는 조합은 0 으로 센다 — 대학까지 빼면 밀도가 거짓으로 오른다.
    const services = [...keys].reduce(
      (sum, k) => sum + (serviceCounts[k] ?? 0),
      0,
    );
    const universities = univs.size;
    const mine = spans.filter((s) => keys.has(workKey(s)));
    return {
      email: o.email,
      name: o.name,
      careerStart: careerStartOf(o),
      universities,
      // `universities` 와 같은 집합이다 — 두 값이 갈리면 어느 쪽이 사실인지 모른다.
      universityNames: [...univs].sort((a, b) => a.localeCompare(b, "ko")),
      services,
      density: universities === 0 ? 0 : services / universities,
      uncounted: [...keys].filter((k) => serviceCounts[k] === undefined).length,
      week: mine.filter((s) => overlaps(s, windows.week)).length,
      month: mine.filter((s) => overlaps(s, windows.month)).length,
      year: mine.filter((s) => overlaps(s, windows.year)).length,
      deviation: null,
      // `month` 의 내역이다 — 머리 숫자와 같은 창을 써야 둘이 안 어긋난다.
      // 연 단위 전건을 넘기지 않는 이유는 한 사람에 수백 줄이 붙기 때문이다.
      running: mine
        .filter((s) => overlaps(s, windows.month))
        .map((s) => ({
          university_name: s.university_name,
          service_name: s.service_name,
          work_kind: s.work_kind,
          start: s.start,
          end: s.end,
          inWeek: overlaps(s, windows.week),
        }))
        .sort((a, b) => a.start.localeCompare(b.start)),
    };
  };

  const byGroup = new Map<string, WorkloadRow[]>();
  for (const o of operators) {
    const key = o.tenure_group ?? UNSET_GROUP;
    byGroup.set(key, [...(byGroup.get(key) ?? []), rowOf(o)]);
  }

  // 연차 순서다 — 가나다순으로 세우면 `1-1` 과 `1-2` 사이에 `10` 이 끼는 날 갈린다.
  const order = [...TENURE_GROUPS, UNSET_GROUP] as readonly string[];
  const groups = [...byGroup.keys()].sort(
    (a, b) => order.indexOf(a) - order.indexOf(b),
  );

  return groups.map((group) => {
    const rows = byGroup.get(group) ?? [];
    if (!targets || group === UNSET_GROUP) return { group, target: null, rows };

    const target = {
      universities: mean(rows.map((r) => r.universities)),
      density: mean(rows.map((r) => r.density)),
    };
    return {
      group,
      target,
      // §6.1 의 dev(op). **산식은 `proposal/objective.ts` 하나뿐이다** — 두 벌이
      // 되면 이 표와 게이트 G6 이 다른 점수를 매겨, 화면에서 통과로 보이는 배치가
      // 서버에서 탈락한다.
      rows: rows.map((r) => ({ ...r, deviation: deviation(r, target) })),
    };
  });
}
