import { describe, it, expect } from "vitest";
import { buildWorkload } from "../workload";

/**
 * 배분현황 — **§6.1 의 근거를 사람이 검산하는 자리**다.
 *
 * 부하 지표 셋 중 둘만 독립이다: `svc = univ × dens` 라 건수는 결과값이고, 목표는
 * `(대학 수, 밀도)` 둘로 잡는다. 그리고 **그룹 안에서만** 견준다 — 한효진(17곳/91건/
 * 5.4)과 김승현(29곳/48건/1.7)의 차이는 연차에 따라 **의도된 것**이라, 전체를
 * 균등화하면 지우려 든다(§3.5).
 *
 * 순수 함수다. 학년도로 자르는 것도, 세 원천에서 건수를 세는 것도 쿼리의 일이다.
 */
const op = (
  email: string,
  name: string,
  tenure_group: string | null,
  assignable = true,
) => ({ email, name, tenure_group, assignable, hired_at: "2020-01-02" });

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
) => ({ university_name, work_kind, assignee_email });

const WINDOWS = {
  week: ["2026-09-14", "2026-09-20"] as [string, string],
  month: ["2026-09-01", "2026-09-30"] as [string, string],
  year: ["2026-03-01", "2027-02-28"] as [string, string],
};

const base = {
  operators: [op("a@x.com", "가운영", "2")],
  cells: [cell("가대", "a@x.com")],
  serviceCounts: { "가대|원서접수": 4 },
  spans: [],
  windows: WINDOWS,
};

/** 첫 그룹의 첫 줄 — 대부분의 단언이 여기를 본다. */
const firstRow = (groups: ReturnType<typeof buildWorkload>) =>
  groups[0].rows[0];

describe("buildWorkload — 대학 수·건수·밀도", () => {
  it("대학 수는 distinct 다 — 한 대학에서 칸을 여럿 맡아도 한 곳이다", () => {
    const groups = buildWorkload({
      ...base,
      cells: [
        cell("가대", "a@x.com"),
        cell("가대", "a@x.com"),
        cell("나대", "a@x.com"),
      ],
      serviceCounts: { "가대|원서접수": 4, "나대|원서접수": 2 },
    });

    expect(firstRow(groups)).toMatchObject({ universities: 2, services: 6 });
  });

  it("밀도는 건수 ÷ 대학 수다", () => {
    const groups = buildWorkload({
      ...base,
      serviceCounts: { "가대|원서접수": 5 },
    });
    expect(firstRow(groups).density).toBe(5);
  });

  it("담당 대학이 없으면 밀도는 0 이다 — 0 으로 나누지 않는다", () => {
    const groups = buildWorkload({ ...base, cells: [] });
    expect(firstRow(groups)).toMatchObject({
      universities: 0,
      services: 0,
      density: 0,
    });
  });

  it("담당이 없어도 줄은 나온다 — 빠지면 '이 사람 왜 없지' 가 된다", () => {
    const groups = buildWorkload({ ...base, cells: [] });
    expect(firstRow(groups).email).toBe("a@x.com");
  });

  it("건수를 모르는 대학은 0 으로 센다 — 성적산출은 원천이 없다", () => {
    // §6.2: 성적산출만 건수 원천이 없어 대학 수로만 본다. 그 대학이 통째로
    // 빠지면 대학 수까지 줄어 밀도가 거짓으로 오른다.
    const groups = buildWorkload({
      ...base,
      cells: [cell("가대", "a@x.com"), cell("없는대", "a@x.com")],
      serviceCounts: { "가대|원서접수": 4 },
    });

    expect(firstRow(groups)).toMatchObject({ universities: 2, services: 4 });
  });

  it("이메일이 없는 칸은 아무에게도 안 세어진다", () => {
    const groups = buildWorkload({
      ...base,
      cells: [cell("가대", "a@x.com"), cell("나대", null)],
      serviceCounts: { "가대|원서접수": 4, "나대|원서접수": 99 },
    });

    expect(firstRow(groups)).toMatchObject({ universities: 1, services: 4 });
  });

  it("명부에 없는 이메일의 칸도 아무에게도 안 세어진다", () => {
    const groups = buildWorkload({
      ...base,
      cells: [cell("가대", "a@x.com"), cell("나대", "유령@x.com")],
      serviceCounts: { "가대|원서접수": 4, "나대|원서접수": 99 },
    });

    expect(groups.flatMap((g) => g.rows)).toHaveLength(1);
    expect(firstRow(groups).services).toBe(4);
  });
});

describe("buildWorkload — 누가 표에 오르나", () => {
  it("배정 대상이 아니면 빠진다", () => {
    // C1: `assignable=true` 인 운영자만 배정받는다. 팀장·이사·테스트 계정이
    // 섞이면 그룹 평균이 통째로 흔들린다.
    const groups = buildWorkload({
      ...base,
      operators: [
        op("a@x.com", "가운영", "2"),
        op("b@x.com", "팀장", "2", false),
      ],
    });

    expect(groups.flatMap((g) => g.rows).map((r) => r.email)).toEqual([
      "a@x.com",
    ]);
  });

  it("그룹 미설정자는 따로 묶이고 목표가 없다 — 평균에 섞이면 안 된다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [op("a@x.com", "가운영", "2"), op("b@x.com", "나운영", null)],
      cells: [cell("가대", "a@x.com"), cell("나대", "b@x.com")],
      serviceCounts: { "가대|원서접수": 4, "나대|원서접수": 40 },
    });

    const unset = groups.find((g) => g.target === null);
    expect(unset?.rows.map((r) => r.email)).toEqual(["b@x.com"]);
    // 밀도 40 짜리가 섞였으면 목표가 그쪽으로 끌려간다.
    const g2 = groups.find((g) => g.group === "2");
    expect(g2?.target).toEqual({ universities: 1, density: 4 });
  });

  it("그룹은 연차 순서다 — 가나다순이 아니다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [
        op("c@x.com", "다운영", "3"),
        op("a@x.com", "가운영", "1-1"),
        op("b@x.com", "나운영", "2"),
      ],
      cells: [],
      serviceCounts: {},
    });

    expect(groups.map((g) => g.group)).toEqual(["1-1", "2", "3"]);
  });
});

describe("buildWorkload — 그룹 목표와 편차", () => {
  it("목표는 그룹 안 평균이다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [op("a@x.com", "가운영", "2"), op("b@x.com", "나운영", "2")],
      cells: [
        cell("가대", "a@x.com"),
        cell("나대", "b@x.com"),
        cell("다대", "b@x.com"),
      ],
      serviceCounts: { "가대|원서접수": 6, "나대|원서접수": 2, "다대|원서접수": 2 },
    });

    // a: 1곳·6건·6.0 / b: 2곳·4건·2.0 → 평균 1.5곳·4.0
    expect(groups[0].target).toEqual({ universities: 1.5, density: 4 });
  });

  /** §6.1 의 `dev(op)` 그대로 — 대학 수 편차율 + 밀도 편차율. */
  it("편차는 두 축의 상대 편차 합이다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [op("a@x.com", "가운영", "2"), op("b@x.com", "나운영", "2")],
      cells: [
        cell("가대", "a@x.com"),
        cell("나대", "b@x.com"),
        cell("다대", "b@x.com"),
      ],
      serviceCounts: { "가대|원서접수": 6, "나대|원서접수": 2, "다대|원서접수": 2 },
    });

    // a: |1-1.5|/1.5 + |6-4|/4 = 0.3333 + 0.5
    expect(groups[0].rows[0].deviation).toBeCloseTo(0.8333, 3);
  });

  it("그룹이 한 명이면 편차가 0 이다 — 자기가 곧 평균이다", () => {
    const groups = buildWorkload(base);
    expect(groups[0].rows[0].deviation).toBe(0);
  });

  it("그룹 목표가 없으면 편차도 없다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [op("b@x.com", "나운영", null)],
      cells: [cell("가대", "b@x.com")],
    });
    expect(groups[0].rows[0].deviation).toBeNull();
  });
});

describe("buildWorkload — 주·월·연 진행", () => {
  const spans = (...s: [string, string, string][]) =>
    s.map(([university_name, start, end]) => ({
      university_name,
      work_kind: "원서접수",
      start,
      end,
    }));

  it("구간이 창과 겹치면 센다 — 창 안에 들어가야 하는 것이 아니다", () => {
    // 접수는 여러 주에 걸친다. '창 안에 통째로 들어간 것' 만 세면 긴 접수가
    // 어느 주에도 안 잡혀 최번월이 비어 보인다.
    const groups = buildWorkload({
      ...base,
      spans: spans(["가대", "2026-09-01", "2026-09-30"]),
    });

    expect(firstRow(groups)).toMatchObject({ week: 1, month: 1, year: 1 });
  });

  it("양끝 경계를 포함한다", () => {
    const groups = buildWorkload({
      ...base,
      spans: spans(
        ["가대", "2026-09-20", "2026-09-25"],
        ["가대", "2026-09-10", "2026-09-14"],
      ),
    });

    expect(firstRow(groups).week).toBe(2);
  });

  it("창 밖이면 안 센다", () => {
    const groups = buildWorkload({
      ...base,
      spans: spans(["가대", "2026-09-21", "2026-09-30"]),
    });

    expect(firstRow(groups)).toMatchObject({ week: 0, month: 1 });
  });

  it("내 대학이 아닌 구간은 안 센다", () => {
    const groups = buildWorkload({
      ...base,
      spans: spans(["남의대", "2026-09-15", "2026-09-16"]),
    });

    expect(firstRow(groups).week).toBe(0);
  });
});

/**
 * **갈린 대학**(§3.1 — 여러 운영자로 갈린 44곳). 같은 대학의 원서접수와 PIMS 를
 * 다른 사람이 맡는다. 건수를 대학 단위로 세면 남의 업무 건수가 내 부하에 붙고,
 * 44곳이 286곳 중 15%라 밀도가 통째로 거짓이 된다.
 */
describe("buildWorkload — 갈린 대학", () => {
  const split = {
    ...base,
    operators: [op("a@x.com", "가운영", "2"), op("b@x.com", "나운영", "2")],
    cells: [
      { university_name: "가대", work_kind: "원서접수", assignee_email: "a@x.com" },
      { university_name: "가대", work_kind: "PIMS", assignee_email: "b@x.com" },
    ],
    serviceCounts: { "가대|원서접수": 4, "가대|PIMS": 40 },
  };

  it("건수는 업무종류별로 붙는다 — 남의 업무는 안 센다", () => {
    const rows = buildWorkload(split).flatMap((g) => g.rows);
    expect(rows.find((r) => r.email === "a@x.com")).toMatchObject({
      universities: 1,
      services: 4,
    });
    expect(rows.find((r) => r.email === "b@x.com")).toMatchObject({
      universities: 1,
      services: 40,
    });
  });

  it("진행 구간도 업무종류로 가른다", () => {
    const rows = buildWorkload({
      ...split,
      spans: [
        {
          university_name: "가대",
          work_kind: "원서접수",
          start: "2026-09-15",
          end: "2026-09-16",
        },
      ],
    }).flatMap((g) => g.rows);

    expect(rows.find((r) => r.email === "a@x.com")?.week).toBe(1);
    expect(rows.find((r) => r.email === "b@x.com")?.week).toBe(0);
  });
});

/**
 * **0 이 두 가지를 뜻한다.** 담당했는데 원천에 그 대학 이름이 없어서 0 이거나
 * (원장 293곳 중 32곳이 `closing_services` 에 이름이 없다), 업무종류에 건수 원천이
 * 아예 없어서 0 이다(성적산출 44곳·상담앱 25곳). 둘 다 '일이 없다' 와 화면에서
 * 구분이 안 되는데, 이 표는 사람의 업무량을 견주는 자리다.
 */
describe("buildWorkload — 못 센 칸", () => {
  it("건수 원천에 없는 칸 수를 따로 센다", () => {
    const groups = buildWorkload({
      ...base,
      cells: [
        cell("가대", "a@x.com"),
        cell("나대", "a@x.com", "성적산출"),
        cell("다대", "a@x.com", "상담앱"),
      ],
      serviceCounts: { "가대|원서접수": 4 },
    });

    expect(firstRow(groups)).toMatchObject({ services: 4, uncounted: 2 });
  });

  it("건수가 0 으로 적힌 것은 못 센 것이 아니다 — 원천이 0 이라고 말했다", () => {
    const groups = buildWorkload({
      ...base,
      serviceCounts: { "가대|원서접수": 0 },
    });

    expect(firstRow(groups).uncounted).toBe(0);
  });

  it("담당이 없으면 못 센 칸도 없다", () => {
    expect(firstRow(buildWorkload({ ...base, cells: [] })).uncounted).toBe(0);
  });
});

describe("buildWorkload — 경력", () => {
  it("경력 시작일을 줄에 싣는다 — 그룹 경계가 왜 거기인지 보이게", () => {
    const groups = buildWorkload({
      ...base,
      operators: [
        { ...op("a@x.com", "가운영", "2"), hired_at: "2020-01-02" },
      ],
    });

    expect(firstRow(groups).careerStart).toBe("2020-01-02");
  });

  it("경력 시작일이 따로 있으면 그쪽이다 — 재입사자는 입사일이 최근이다", () => {
    const groups = buildWorkload({
      ...base,
      operators: [
        {
          ...op("a@x.com", "가운영", "2"),
          hired_at: "2024-05-01",
          career_start_at: "2011-03-01",
        },
      ],
    });

    expect(firstRow(groups).careerStart).toBe("2011-03-01");
  });
});

describe("buildWorkload — 그룹이 비어 있는 모양", () => {
  it("칸이 아예 없어도 미설정으로 묶인다 — null 과 같다", () => {
    // `operators.tenure_group` 이 `nullable().optional()` 이라 undefined 로 온다.
    const groups = buildWorkload({
      ...base,
      operators: [
        {
          email: "a@x.com",
          name: "가운영",
          assignable: true,
          hired_at: "2020-01-02",
        },
      ],
    });

    expect(groups[0]).toMatchObject({ group: "그룹 미설정", target: null });
  });
});
