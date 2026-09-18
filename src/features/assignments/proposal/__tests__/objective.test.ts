import { describe, it, expect } from "vitest";
import {
  ASSIGNMENT_LIMITS,
  deviation,
  applyMoves,
  sumDeviation,
  type ProposedMove,
} from "../objective";
import { buildWorkload } from "../../workload";

/**
 * §6.1 의 산식 — **판정하지 않고 채점한다**(rev 2). rev 1 은 여기 탐욕적 이동
 * 생성기를 뒀지만, 생성은 에이전트가 하고 이 모듈은 **에이전트가 지켜야 할
 * 제약**과 그 채점만 갖는다.
 *
 * 상한이 여기 있는 이유는 **프롬프트와 게이트가 같은 상수를 봐야** 하기 때문이다
 * (§6.1 끝). 두 벌이 되면 모델에게는 3곳이라 말하고 5곳을 받아 주게 된다.
 */
const op = (email: string, tenure_group: string | null) => ({
  email,
  name: email,
  tenure_group,
  assignable: true,
  hired_at: "2020-01-02",
});

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
) => ({
  university_name,
  work_kind,
  assignee_email,
});

const WINDOWS = {
  week: ["2026-09-14", "2026-09-20"] as [string, string],
  month: ["2026-09-01", "2026-09-30"] as [string, string],
  year: ["2026-03-01", "2027-02-28"] as [string, string],
};

const move = (o: Partial<ProposedMove> = {}): ProposedMove => ({
  university_name: "가대",
  work_kind: "원서접수",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "과부하 해소",
  ...o,
});

describe("ASSIGNMENT_LIMITS", () => {
  it("상한은 운영자 3곳 · 배치 15곳이다", () => {
    expect(ASSIGNMENT_LIMITS).toEqual({ perOperator: 3, perBatch: 15 });
  });
});

describe("deviation", () => {
  it("두 축의 상대 편차 합이다 — §6.1 의 dev(op)", () => {
    // |1-1.5|/1.5 + |6-4|/4 = 0.3333 + 0.5
    expect(
      deviation(
        { universities: 1, density: 6 },
        { universities: 1.5, density: 4 },
      ),
    ).toBeCloseTo(0.8333, 3);
  });

  it("목표가 0 인 축은 0 으로 센다 — 전원이 0곳이면 견줄 것이 없다", () => {
    expect(
      deviation(
        { universities: 3, density: 2 },
        { universities: 0, density: 0 },
      ),
    ).toBe(0);
  });
});

describe("applyMoves", () => {
  it("그 대학·업무종류의 칸을 통째로 옮긴다 — 하위유형만 옮기면 그게 분할이다", () => {
    // 원장은 하위유형마다 한 줄이라, 한 줄만 옮기면 C4 가 막으려던 분할을 만든다.
    const cells = [
      cell("가대", "a@x.com"),
      cell("가대", "a@x.com"),
      cell("가대", "a@x.com", "PIMS"),
      cell("나대", "a@x.com"),
    ];

    expect(applyMoves(cells, [move()])).toEqual([
      cell("가대", "b@x.com"),
      cell("가대", "b@x.com"),
      cell("가대", "a@x.com", "PIMS"),
      cell("나대", "a@x.com"),
    ]);
  });

  it("원본을 건드리지 않는다", () => {
    const cells = [cell("가대", "a@x.com")];
    applyMoves(cells, [move()]);
    expect(cells[0].assignee_email).toBe("a@x.com");
  });

  it("없는 대학을 옮기라고 해도 칸을 만들지 않는다", () => {
    const cells = [cell("가대", "a@x.com")];
    expect(applyMoves(cells, [move({ university_name: "없는대" })])).toEqual(
      cells,
    );
  });

  it("이동이 없으면 그대로다", () => {
    const cells = [cell("가대", "a@x.com")];
    expect(applyMoves(cells, [])).toEqual(cells);
  });
});

describe("sumDeviation", () => {
  // a 가 3곳, b 가 1곳 — **쏠려 있어야** 이동이 합을 줄이는지 볼 수 있다.
  // 2곳 대 1곳처럼 대칭인 배치는 한 곳을 옮겨도 합이 그대로라 아무것도 증명하지 못한다.
  const input = {
    operators: [op("a@x.com", "2"), op("b@x.com", "2")],
    cells: [
      cell("가대", "a@x.com"),
      cell("나대", "a@x.com"),
      cell("다대", "a@x.com"),
      cell("라대", "b@x.com"),
    ],
    serviceCounts: {
      "가대|원서접수": 2,
      "나대|원서접수": 2,
      "다대|원서접수": 2,
      "라대|원서접수": 2,
    },
    spans: [],
    windows: WINDOWS,
  };

  it("그룹 목표가 있는 줄의 편차를 모두 더한다", () => {
    // a: 3곳·밀도 2 / b: 1곳·밀도 2 → 목표 2곳·2 → 각 |1|/2 = 0.5
    expect(sumDeviation(buildWorkload(input))).toBeCloseTo(1, 6);
  });

  it("목표가 없는 묶음은 안 더한다 — 견줄 기준이 없다", () => {
    const groups = buildWorkload({
      ...input,
      operators: [op("a@x.com", null), op("b@x.com", null)],
    });
    expect(sumDeviation(groups)).toBe(0);
  });

  it("이동이 쏠림을 풀면 합이 줄어든다 — G6 이 보는 값이다", () => {
    const before = sumDeviation(buildWorkload(input));
    const after = sumDeviation(
      buildWorkload({
        ...input,
        cells: applyMoves(input.cells, [move({ university_name: "다대" })]),
      }),
    );

    // 3곳 대 1곳이 2곳 대 2곳이 된다 — 편차가 사라진다.
    expect(after).toBeLessThan(before);
    expect(after).toBe(0);
  });
});
