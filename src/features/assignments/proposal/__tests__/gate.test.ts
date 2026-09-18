import { describe, it, expect } from "vitest";
import { runGates, type GateContext } from "../gate";
import { ASSIGNMENT_LIMITS, type ProposedMove } from "../objective";

/**
 * **응답은 그대로 믿지 않는다**(§6.3). 게이트가 없으면 모델이 44곳을 흩어 놓거나
 * 한 사람에게 30곳을 몰아주는 배치가 관리자 화면까지 올라온다.
 *
 * **배정값을 단언하지 않는다** — 같은 입력에 다른 답이 날 수 있다. 단언하는 것은
 * G1~G7 이 위반 줄을 걸러내는가뿐이고, 모델 응답은 고정 fixture 로 넣는다.
 *
 * 게이트 순서가 곧 보고에 남는 이유다. 순수 검사(G1~G4·G7)를 먼저 끝내고 누적
 * 상태를 보는 것(G5 상한 · G6 Σdev)을 뒤에 둔다 — 떨어질 줄이 상한을 깎아먹으면
 * 뒤 줄이 엉뚱한 이유로 탈락한다.
 */
const op = (email: string, tenure_group: string | null, assignable = true) => ({
  email,
  name: email,
  tenure_group,
  assignable,
  hired_at: "2020-01-02",
});

const cell = (
  university_name: string,
  assignee_email: string | null,
  work_kind = "원서접수",
  subtype = "수시",
  role = "운영",
) => ({ university_name, work_kind, subtype, role, assignee_email });

const move = (o: Partial<ProposedMove> = {}): ProposedMove => ({
  university_name: "가대",
  work_kind: "원서접수",
  prev_assignee: "a@x.com",
  next_assignee: "b@x.com",
  reason: "2그룹 평균보다 많다",
  ...o,
});

/**
 * a 가 3곳, b 가 1곳 — 쏠려 있어야 이동이 Σdev 를 줄이는지 볼 수 있다.
 * 대칭 배치는 무엇을 옮겨도 합이 그대로라 G6 이 아무것도 증명하지 못한다.
 */
const ctx = (o: Partial<GateContext> = {}): GateContext => ({
  operators: [op("a@x.com", "2"), op("b@x.com", "2")],
  ledger: [
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
  windows: {
    week: ["2026-09-14", "2026-09-20"],
    month: ["2026-09-01", "2026-09-30"],
    year: ["2026-03-01", "2027-02-28"],
  },
  ...o,
});

const gateOf = (moves: ProposedMove[], c = ctx()) =>
  runGates(moves, c).rejected.map((r) => r.gate);

describe("runGates — 통과", () => {
  it("쏠림을 푸는 이동은 통과한다", () => {
    const r = runGates([move()], ctx());

    expect(r.rejected).toEqual([]);
    expect(r.accepted).toHaveLength(1);
  });

  it("이동이 없으면 빈 결과다", () => {
    expect(runGates([], ctx())).toEqual({ accepted: [], rejected: [] });
  });
});

describe("G1 — 제안 담당자가 배정 대상인가", () => {
  it("assignable=false 인 사람에게 주면 막는다", () => {
    // 팀장·부장·이사·기획팀·테스트 계정이 false 다(§3.4). 그들에게 대학이 붙으면
    // 그룹 평균이 통째로 흔들린다.
    const c = ctx({
      operators: [op("a@x.com", "2"), op("b@x.com", "2", false)],
    });

    expect(gateOf([move()], c)).toEqual(["G1"]);
  });

  it("명부에 없는 주소면 막는다", () => {
    expect(gateOf([move({ next_assignee: "유령@x.com" })])).toEqual(["G1"]);
  });
});

describe("G2 — 경합", () => {
  it("이전 담당자가 지금 원장과 다르면 막는다", () => {
    // 판정이 도는 사이에 사람이 손으로 고쳤을 수 있다(§5.4). 덮어쓰면 그 편집이
    // 사라지고, 이력에는 정당한 변경으로 남아 사고로 구분되지 않는다.
    expect(gateOf([move({ prev_assignee: "b@x.com" })])).toEqual(["G2"]);
  });

  it("그 칸이 원장에 아예 없으면 막는다", () => {
    expect(gateOf([move({ university_name: "없는대" })])).toEqual(["G2"]);
  });
});

describe("G3 — 그룹 밖 이동", () => {
  it("다른 연차 그룹으로 옮기면 막는다", () => {
    // 한효진(17곳/5.4)과 김승현(29곳/1.7)의 차이는 연차에 따라 의도된 것이다(§3.5).
    const c = ctx({ operators: [op("a@x.com", "2"), op("b@x.com", "5")] });

    expect(gateOf([move()], c)).toEqual(["G3"]);
  });

  it("그룹 미설정자가 끼면 막는다 — 견줄 기준이 없다", () => {
    const c = ctx({ operators: [op("a@x.com", "2"), op("b@x.com", null)] });

    expect(gateOf([move()], c)).toEqual(["G3"]);
  });

  it("이전 담당자가 비어 있으면 막는다 — 이동이 아니다", () => {
    // 미배정을 채우는 것은 재배분이 아니라 단건의 일이다(`single.ts`).
    const c = ctx({
      ledger: [
        cell("가대", null),
        cell("나대", "a@x.com"),
        cell("다대", "a@x.com"),
        cell("라대", "b@x.com"),
      ],
    });

    expect(gateOf([move({ prev_assignee: null })], c)).toEqual(["G3"]);
  });
});

describe("G4 — 갈린 건", () => {
  it("하위유형이 갈린 건은 건드리지 않는다", () => {
    const c = ctx({
      ledger: [
        cell("가대", "a@x.com", "원서접수", "수시"),
        cell("가대", "b@x.com", "원서접수", "정시"),
        cell("나대", "a@x.com"),
        cell("다대", "a@x.com"),
        cell("라대", "b@x.com"),
      ],
    });

    // **이유까지 본다.** 하위유형이 갈리면 그 대학은 대학 단위로도 갈려 있어
    // 두 검사가 겹친다 — id 만 보면 앞 검사를 지워도 테스트가 초록이다.
    expect(runGates([move()], c).rejected[0]).toMatchObject({
      gate: "G4",
      reason: expect.stringMatching(/하위유형/),
    });
  });

  it("업무종류가 여러 사람으로 갈린 대학도 건드리지 않는다 — 44곳이다", () => {
    // 사람이 이유가 있어 갈라놓은 것으로 보고 보존한다(§6.1 C4).
    const c = ctx({
      ledger: [
        cell("가대", "a@x.com", "원서접수"),
        cell("가대", "b@x.com", "PIMS"),
        cell("나대", "a@x.com"),
        cell("다대", "a@x.com"),
        cell("라대", "b@x.com"),
      ],
    });

    expect(runGates([move()], c).rejected[0]).toMatchObject({
      gate: "G4",
      reason: expect.stringMatching(/갈린 대학/),
    });
  });

  it("개발 칸이 다른 이름이어도 갈린 것이 아니다 — 배정은 운영 칸이다", () => {
    // 개발자는 `operators` 밖이라 배정 대상이 될 수 없다(PR4b).
    const c = ctx({
      ledger: [
        cell("가대", "a@x.com", "원서접수", "수시"),
        cell("가대", null, "원서접수", "수시", "개발"),
        cell("나대", "a@x.com"),
        cell("다대", "a@x.com"),
        cell("라대", "b@x.com"),
      ],
    });

    expect(gateOf([move()], c)).toEqual([]);
  });
});

describe("G5 — 상한", () => {
  /**
   * 주는 사람이 확실히 과부하여야 각 이동이 Σdev 를 줄인다. 1곳씩 가진 사람들
   * 사이에서 한 곳을 옮기는 배치는 **대칭이라 합이 그대로**여서, G5 를 재려다
   * G6 에서 먼저 떨어진다(처음 픽스처가 그랬다).
   */
  const lopsided = (pairs: number, each: number) => {
    const operators = [];
    const ledger = [];
    const serviceCounts: Record<string, number> = {};
    const moves: ProposedMove[] = [];

    for (let p = 0; p < pairs; p++) {
      operators.push(op(`g${p}@x.com`, "2"), op(`r${p}@x.com`, "2"));
      for (let u = 0; u < 10; u++) {
        const name = `대학${p}-${u}`;
        ledger.push(cell(name, `g${p}@x.com`));
        serviceCounts[`${name}|원서접수`] = 2;
        if (u < each) {
          moves.push(
            move({
              university_name: name,
              prev_assignee: `g${p}@x.com`,
              next_assignee: `r${p}@x.com`,
            }),
          );
        }
      }
    }
    return { c: ctx({ operators, ledger, serviceCounts }), moves };
  };

  it("배치 상한을 넘는 줄은 막는다", () => {
    // 6쌍 × 3곳 = 18 이동. 사람마다 3곳이라 1인 상한에는 안 걸린다.
    const { c, moves } = lopsided(6, ASSIGNMENT_LIMITS.perOperator);

    const r = runGates(moves, c);
    expect(r.accepted).toHaveLength(ASSIGNMENT_LIMITS.perBatch);
    expect(r.rejected.map((x) => x.gate)).toEqual(
      Array(moves.length - ASSIGNMENT_LIMITS.perBatch).fill("G5"),
    );
  });

  it("한 사람이 상한을 넘게 관여하면 막는다 — 받는 쪽도 센다", () => {
    // 연속성을 지키려는 상한이라 주는 쪽이든 받는 쪽이든 담당 목록이 흔들린다.
    const { c, moves } = lopsided(1, ASSIGNMENT_LIMITS.perOperator + 1);

    const r = runGates(moves, c);
    expect(r.accepted).toHaveLength(ASSIGNMENT_LIMITS.perOperator);
    expect(r.rejected.map((x) => x.gate)).toEqual(["G5"]);
  });
});

describe("G6 — Σdev 개선", () => {
  it("쏠림을 키우는 이동은 막는다", () => {
    // b 가 1곳인데 거기서 더 빼내 a 에게 주면 편차가 커진다.
    expect(
      gateOf([
        move({
          university_name: "라대",
          prev_assignee: "b@x.com",
          next_assignee: "a@x.com",
        }),
      ]),
    ).toEqual(["G6"]);
  });

  it("아무것도 바꾸지 않는 이동은 막는다 — 개선이 없다", () => {
    expect(gateOf([move({ next_assignee: "a@x.com" })])).toEqual(["G6"]);
  });

  it("앞 줄이 이미 균형을 맞췄으면 뒷줄은 막힌다 — 누적으로 잰다", () => {
    const r = runGates([move(), move({ university_name: "나대" })], ctx());

    expect(r.accepted).toHaveLength(1);
    expect(r.rejected.map((x) => x.gate)).toEqual(["G6"]);
  });
});

describe("G7 — 근거", () => {
  it("근거가 비면 막는다 — 사람이 승인할 수 없다", () => {
    expect(gateOf([move({ reason: "" })])).toEqual(["G7"]);
  });
});

describe("보고", () => {
  it("탈락 줄마다 어긴 게이트와 읽을 수 있는 이유가 남는다", () => {
    const r = runGates([move({ reason: "" })], ctx());

    expect(r.rejected[0]).toMatchObject({
      gate: "G7",
      move: expect.objectContaining({ university_name: "가대" }),
      reason: expect.stringMatching(/근거/),
    });
  });
});
