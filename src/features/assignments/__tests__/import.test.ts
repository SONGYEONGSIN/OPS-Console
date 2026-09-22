import { describe, it, expect } from "vitest";
import {
  parseBaejungList,
  parsePims,
  parseSimpleSheet,
  BAEJUNG_CURRENT_YEAR,
  BAEJUNG_PREV_YEAR,
} from "../parse";
import type { AssignmentSheet } from "../schemas";
import {
  toLedgerRows,
  normalizeUniversityName,
  linkAssignees,
  type LedgerRowDraft,
} from "../import";

/**
 * fixture 는 **라이브 시트의 좌표를 그대로** 쓴다(2026-09-13 실측).
 *
 * r0: 1 대분류 · 3 대학명 · 12/18/24/30 이 2027운영/2027개발/2026운영/2026개발 블록 시작
 * r1: 각 블록 6칸이 `재외·수시·정시·편입·외국인·백업자`
 *
 * 여섯 번째 라벨이 **`백업자`** 다 — 설계 문서는 `백업` 으로 적었지만 시트가 그렇지
 * 않다. 파서가 r1 라벨을 그대로 `subtypes[].label` 에 담으므로 원장의 `subtype` 도
 * `백업자` 가 된다. 문서를 보고 fixture 를 만들면 실제와 다른 것을 시험하게 된다.
 */
const WIDTH = 39;
const SUBTYPES = ["재외", "수시", "정시", "편입", "외국인", "백업자"] as const;

function blank(): string[] {
  return Array.from({ length: WIDTH }, () => "");
}

function header0(): string[] {
  const r = blank();
  r[1] = "대분류";
  r[3] = "대학명";
  // 헤더를 **상수로 만든다** — 파서의 정규식과 이 상수가 갈리면 여기서 빨개진다.
  // 파서는 학년도를 시트 헤더 문자열에서 찾고 시계에서 도출하지 않는다. 이관이
  // `currentAcademicYear()` 를 넘기면 3월에 학년도가 넘어갈 때 2027 블록의 값을
  // 2028 로 적재하고, 대조는 양쪽이 같은 시트에서 나오므로 그대로 통과한다.
  r[12] = `${BAEJUNG_CURRENT_YEAR}학년도 운영자`;
  r[18] = `${BAEJUNG_CURRENT_YEAR}학년도 개발자`;
  r[24] = `${BAEJUNG_PREV_YEAR}학년도 운영자`;
  r[30] = `${BAEJUNG_PREV_YEAR}학년도 개발자`;
  return r;
}

function header1(): string[] {
  const r = blank();
  for (const start of [12, 18, 24, 30]) {
    SUBTYPES.forEach((label, i) => {
      r[start + i] = label;
    });
  }
  return r;
}

/** 한 대학 행 — 블록 시작 → 하위유형별 이름 맵. */
function dataRow(
  university: string,
  opts: {
    universityType?: string;
    op2027?: Partial<Record<(typeof SUBTYPES)[number], string>>;
    dev2027?: Partial<Record<(typeof SUBTYPES)[number], string>>;
    op2026?: Partial<Record<(typeof SUBTYPES)[number], string>>;
  } = {},
): string[] {
  const r = blank();
  r[3] = university;
  if (opts.universityType) r[1] = opts.universityType;
  const fill = (start: number, m?: Partial<Record<string, string>>) => {
    if (!m) return;
    SUBTYPES.forEach((label, i) => {
      const v = m[label];
      if (v) r[start + i] = v;
    });
  };
  fill(12, opts.op2027);
  fill(18, opts.dev2027);
  fill(24, opts.op2026);
  return r;
}

function sheet02(rows: string[][]): AssignmentSheet {
  const rowsText = [header0(), header1(), ...rows];
  return {
    worksheetName: "02. 배정리스트",
    rowsText,
    rowCount: rowsText.length,
    columnCount: WIDTH,
  };
}

const ALL_SIX = {
  재외: "가운영",
  수시: "나운영",
  정시: "다운영",
  편입: "라운영",
  외국인: "마운영",
  백업자: "바운영",
} as const;

const ALL_SIX_DEV = {
  재외: "가개발",
  수시: "나개발",
  정시: "다개발",
  편입: "라개발",
  외국인: "마개발",
  백업자: "바개발",
} as const;

/** 배정이 되는 다섯 — 여섯 번째 `백업자` 는 배정이 아니다(아래 테스트). */
const ASSIGNED_SUBTYPES = SUBTYPES.filter((s) => s !== "백업자");

describe("toLedgerRows — 원서접수(02. 배정리스트)", () => {
  it("2027 운영/개발 × 5 하위유형이 10행이 된다", () => {
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", {
          universityType: "4년제",
          op2027: ALL_SIX,
          dev2027: ALL_SIX_DEV,
        }),
      ]),
    );
    const { rows } = toLedgerRows(recs, 2027);

    expect(rows).toHaveLength(10);
    expect(rows.every((r) => r.work_kind === "원서접수")).toBe(true);
    expect(rows.every((r) => r.academic_year === 2027)).toBe(true);
    expect([...new Set(rows.map((r) => r.subtype))].sort()).toEqual(
      [...ASSIGNED_SUBTYPES].sort(),
    );
    expect(rows.filter((r) => r.role === "운영")).toHaveLength(5);
    expect(rows.filter((r) => r.role === "개발")).toHaveLength(5);
  });

  it("백업자 칸은 배정이 아니다 — 원장 행을 만들지 않는다", () => {
    /*
     * 시트 r1 의 여섯 번째 라벨은 설계 문서의 `백업` 이 아니라 **`백업자`** 다
     * (2026-09-13 실측) — 라벨은 여전히 시트에서 가져온다. 바뀐 것은 그 칸을
     * **어디로 보내는가**다.
     *
     * 백업자는 운영자 공백 때 대신 볼 사람이지 배정이 아니다. 하위유형으로
     * 흘려보내면 `원서접수|백업자|운영` 이 정식 배정으로 원장에 들어가,
     * 배분현황이 담당 부하로 세고 제안 판정이 옮길 대상으로 본다.
     *
     * 라이브 실측(2026-09-21): 2027 백업자 칸 **0행** · 2026 백업자 칸 22행.
     * 지금은 비어 있어 드러나지 않을 뿐이고, 사람이 채우는 날 조용히 오염된다.
     */
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", { op2027: { 수시: "나운영", 백업자: "바운영" } }),
      ]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows.map((r) => r.subtype)).toEqual(["수시"]);
  });

  it("2026 칸은 이관하지 않는다 — 2027 만 넣는다", () => {
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", {
          op2027: { 수시: "나운영" },
          op2026: ALL_SIX,
        }),
      ]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows).toHaveLength(1);
    expect(rows[0].academic_year).toBe(2027);
  });

  it("빈 칸은 행을 만들지 않는다", () => {
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", {
          op2027: { 수시: "나운영" },
          dev2027: { 정시: "다개발" },
        }),
      ]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => `${r.subtype}/${r.role}`).sort()).toEqual([
      "수시/운영",
      "정시/개발",
    ]);
  });

  it("대분류를 university_type 스냅샷으로 싣는다", () => {
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", {
          universityType: "4년제",
          op2027: { 수시: "나운영" },
        }),
      ]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows[0].university_type).toBe("4년제");
  });

  it("담당자 이름을 assignee_name 으로 싣는다 — 이메일 매칭은 뒤 단계다", () => {
    const recs = parseBaejungList(
      sheet02([dataRow("서울대학교", { op2027: { 수시: "나운영" } })]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows[0].assignee_name).toBe("나운영");
  });
});

describe("toLedgerRows — PIMS(04)", () => {
  function pimsSheet(rows: { uni: string; full?: string; hwan?: string }[]) {
    const head = ["대학명", "운영자 FULL", "운영자 환/충"];
    return {
      worksheetName: "04. PIMS",
      rowsText: [head, ...rows.map((r) => [r.uni, r.full ?? "", r.hwan ?? ""])],
      rowCount: rows.length + 1,
      columnCount: 3,
    } satisfies AssignmentSheet;
  }

  it("FULL 만 있으면 subtype='FULL' 운영 1행", () => {
    const { rows } = toLedgerRows(
      parsePims(pimsSheet([{ uni: "서울대학교", full: "가운영" }])),
      2027,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      work_kind: "PIMS",
      subtype: "FULL",
      role: "운영",
      assignee_name: "가운영",
    });
  });

  it("환충 만 있으면 subtype='환충' 운영 1행 — FULL 행을 만들지 않는다", () => {
    const { rows } = toLedgerRows(
      parsePims(pimsSheet([{ uni: "서울대학교", hwan: "나운영" }])),
      2027,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      subtype: "환충",
      role: "운영",
      assignee_name: "나운영",
    });
  });

  it("PIMS 는 개발 행이 생기지 않는다", () => {
    const { rows } = toLedgerRows(
      parsePims(
        pimsSheet([
          { uni: "서울대학교", full: "가운영" },
          { uni: "고려대학교", hwan: "나운영" },
        ]),
      ),
      2027,
    );
    expect(rows.every((r) => r.role === "운영")).toBe(true);
  });

  it("FULL 과 환충 둘 다 있으면 두 행이 된다", () => {
    const { rows, issues } = toLedgerRows(
      parsePims(
        pimsSheet([{ uni: "서울대학교", full: "가운영", hwan: "나운영" }]),
      ),
      2027,
    );
    expect(
      Object.fromEntries(rows.map((r) => [r.subtype, r.assignee_name])),
    ).toEqual({ FULL: "가운영", 환충: "나운영" });
    expect(issues).toEqual([]);
  });

  it("둘 다 같은 사람이어도 두 행이다 — 한 사람이 두 칸을 맡은 것이다", () => {
    // 예전에는 `operator = full || hwan` 이 접은 값만 보여 '모호함' 으로 보고했다.
    // 시트의 두 칸을 따로 읽으니 가릴 것이 없다(사용자 확인 2026-09-15).
    // 라이브에는 이런 행이 0건이지만 **불변식이 아니고**, 접으면 FULL 이 조용히 사라진다.
    const { rows, issues } = toLedgerRows(
      parsePims(
        pimsSheet([{ uni: "서울대학교", full: "가운영", hwan: "가운영" }]),
      ),
      2027,
    );
    expect(rows.map((r) => r.subtype).sort()).toEqual(["FULL", "환충"]);
    expect(rows.every((r) => r.assignee_name === "가운영")).toBe(true);
    expect(issues).toEqual([]);
  });
});

describe("toLedgerRows — 하위유형 없는 업무(03·06·07)", () => {
  function simple(
    service: "대학원" | "성적산출" | "상담앱",
    op: string,
    dev: string,
  ) {
    const sheet: AssignmentSheet = {
      worksheetName: service,
      rowsText: [
        ["대학명", "운영자", "개발자"],
        ["서울대학교", op, dev],
      ],
      rowCount: 2,
      columnCount: 3,
    };
    return parseSimpleSheet(sheet, service, {
      uni: /대학명/,
      op: /^운영자$/,
      dev: /^개발자$/,
    });
  }

  it("subtype 은 빈 문자열이다 — null 이면 자연키가 무력해진다", () => {
    const { rows } = toLedgerRows(simple("대학원", "가운영", "가개발"), 2027);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.subtype === "")).toBe(true);
  });

  it("운영·개발 각각 한 행이 된다", () => {
    const { rows } = toLedgerRows(simple("성적산출", "가운영", "가개발"), 2027);
    expect(rows.map((r) => r.role).sort()).toEqual(["개발", "운영"]);
  });

  it("개발자 칸이 비면 개발 행이 없다", () => {
    const { rows } = toLedgerRows(simple("상담앱", "가운영", ""), 2027);
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe("운영");
  });
});

describe("toLedgerRows — 전년도 배정(前 운영자)", () => {
  /**
   * `04` 의 전년도 칸은 **`前 운영자` 한 칸**이다 — FULL·환충으로 갈라져 있지 않다.
   *
   * 올해 칸을 함께 둔 시트로 시험한다. `前\s*운영자` 가 `운영자 FULL` 을 먼저
   * 집으면 작년 자리에 올해 이름이 적재되는데, **그건 에러 없이 조용하다.**
   */
  function prevPimsSheet(prev: string) {
    return {
      worksheetName: "04. PIMS",
      rowsText: [
        ["대학명", "운영자 FULL", "운영자 환/충", "前 운영자"],
        ["서울대학교", "올해풀", "올해환", prev],
      ],
      rowCount: 2,
      columnCount: 4,
    } satisfies AssignmentSheet;
  }

  const prevPims = (prev: string) =>
    parseSimpleSheet(prevPimsSheet(prev), "PIMS", {
      uni: /대학명/,
      op: /前\s*운영자/,
    });

  it("하위유형 없는 PIMS 도 한 줄이 된다 — 업무종류로 가르면 0줄이 조용히 나온다", () => {
    /*
     * 예전 라우팅은 업무종류(`원서접수`·`PIMS`)로 갈랐다. 전년도 PIMS 는 하위유형이
     * 없어서 빈 `subtypes` 를 훑고 **아무 행도 만들지 않는데, 이관은 성공으로 끝난다**
     * — 화면의 작년 배분현황만 통째로 빈다.
     */
    const { rows } = toLedgerRows(prevPims("작년운영"), BAEJUNG_PREV_YEAR);

    expect(rows).toEqual([
      {
        academic_year: BAEJUNG_PREV_YEAR,
        university_name: "서울대학교",
        work_kind: "PIMS",
        subtype: "",
        role: "운영",
        assignee_name: "작년운영",
        university_type: undefined,
      },
    ]);
  });

  it("올해 칸을 집지 않는다 — 같은 시트에 `운영자 FULL` 이 먼저 있다", () => {
    const { rows } = toLedgerRows(prevPims("작년운영"), BAEJUNG_PREV_YEAR);

    expect(rows.map((r) => r.assignee_name)).not.toContain("올해풀");
  });

  it("빈 칸은 행을 만들지 않는다 — 없는 배정을 발명하지 않는다", () => {
    expect(toLedgerRows(prevPims(""), BAEJUNG_PREV_YEAR).rows).toEqual([]);
  });

  it("하위유형을 가진 레코드는 그대로 칸마다 한 줄이다 — 올해 결과가 안 바뀐다", () => {
    const sheet = {
      worksheetName: "04. PIMS",
      rowsText: [
        ["대학명", "운영자 FULL", "운영자 환/충"],
        ["서울대학교", "올해풀", "올해환"],
      ],
      rowCount: 2,
      columnCount: 3,
    } satisfies AssignmentSheet;

    const { rows } = toLedgerRows(parsePims(sheet), BAEJUNG_CURRENT_YEAR);

    expect(rows.map((r) => [r.subtype, r.assignee_name])).toEqual([
      ["FULL", "올해풀"],
      ["환충", "올해환"],
    ]);
  });
});

describe("linkAssignees", () => {
  /**
   * 원장 행의 **이메일**을 이름으로 찾는다. 이름 스냅샷만으로는 화면이 배정을 못
   * 센다 — 배분현황이 운영자를 이메일로 묶으므로, 이메일이 비면 그 사람은 아무것도
   * 안 맡은 것으로 보인다.
   */
  const draft = (name: string): LedgerRowDraft => ({
    academic_year: 2026,
    university_name: "가대학교",
    work_kind: "대학원",
    subtype: "",
    role: "운영",
    assignee_name: name,
  });

  it("명부에 있는 이름은 이메일이 붙는다", () => {
    const { rows } = linkAssignees(
      [draft("가운영")],
      [{ email: "ga@x.com", name: "가운영" }],
    );

    expect(rows[0].assignee_email).toBe("ga@x.com");
    expect(rows[0].assignee_name).toBe("가운영");
  });

  it("같은 이름이 둘이면 잇지 않는다 — 추측하면 틀린 사람에게 부하가 붙는다", () => {
    /*
     * 설계 F1. 동명이인은 이름으로 가를 수 없고, 골라 이으면 그게 틀렸다는 것을
     * 아무도 모른다. 이름만 남기면 화면이 '연결 안 됨' 으로 드러내고 사람이 고친다.
     */
    const { rows, ambiguousNames } = linkAssignees(
      [draft("가운영")],
      [
        { email: "ga1@x.com", name: "가운영" },
        { email: "ga2@x.com", name: "가운영" },
      ],
    );

    expect(rows[0].assignee_email).toBeNull();
    expect(rows[0].assignee_name).toBe("가운영");
    expect(ambiguousNames).toEqual(["가운영"]);
  });

  it("명부에 없는 이름은 이름만 남는다 — FK 가 23503 으로 적재를 죽인다", () => {
    const { rows, ambiguousNames } = linkAssignees(
      [draft("없는사람")],
      [{ email: "ga@x.com", name: "가운영" }],
    );

    expect(rows[0].assignee_email).toBeNull();
    expect(rows[0].assignee_name).toBe("없는사람");
    // 동명이인이 아니라 그냥 없는 것이다 — 고치는 방법이 다르다.
    expect(ambiguousNames).toEqual([]);
  });

  it("같은 이름이 여러 줄에 있어도 보고는 한 번이다", () => {
    const { ambiguousNames } = linkAssignees(
      [draft("가운영"), draft("가운영"), draft("가운영")],
      [
        { email: "ga1@x.com", name: "가운영" },
        { email: "ga2@x.com", name: "가운영" },
      ],
    );

    expect(ambiguousNames).toEqual(["가운영"]);
  });

  it("명부 이름의 앞뒤 공백은 무시한다 — 엑셀에서 흔하다", () => {
    const { rows } = linkAssignees(
      [draft("가운영")],
      [{ email: "ga@x.com", name: " 가운영 " }],
    );

    expect(rows[0].assignee_email).toBe("ga@x.com");
  });

  it("빈 이름은 명부의 빈 이름과 이어지지 않는다", () => {
    /*
     * `operators.name` 은 not null default '' 라 이름이 안 들어간 계정이 있을 수
     * 있다. 빈 칸끼리 맞으면 **아무 배정도 아닌 행이 그 사람에게 붙는다.**
     */
    const { rows } = linkAssignees(
      [draft("")],
      [{ email: "nobody@x.com", name: "" }],
    );

    expect(rows[0].assignee_email).toBeNull();
  });

  it("행의 나머지 칸은 그대로 옮긴다", () => {
    const { rows } = linkAssignees([draft("가운영")], []);

    expect(rows[0]).toMatchObject({
      academic_year: 2026,
      university_name: "가대학교",
      work_kind: "대학원",
      subtype: "",
      role: "운영",
    });
  });
});

describe("normalizeUniversityName", () => {
  it("앞뒤 공백을 지우고 사이 공백을 한 칸으로 접는다", () => {
    expect(normalizeUniversityName("  서울   대학교 ")).toBe("서울 대학교");
  });

  it("별칭을 잇지 않는다 — '서울대'와 '서울대학교'는 다른 대학이다", () => {
    // F1: 표기가 갈리면 새 대학으로 보여 미배정 1건이 뜬다. 추측해 잇지 않고
    // 보고하고 사람이 고친다.
    expect(normalizeUniversityName("서울대")).toBe("서울대");
    expect(normalizeUniversityName("서울대학교")).toBe("서울대학교");
  });

  it("탭·줄바꿈도 한 칸으로 접는다", () => {
    expect(normalizeUniversityName("서울\t대학교\n")).toBe("서울 대학교");
  });
});

describe("toLedgerRows — 멱등", () => {
  it("같은 입력을 두 번 넣어도 자연키가 겹치는 행이 없다", () => {
    const recs = parseBaejungList(
      sheet02([
        dataRow("서울대학교", { op2027: ALL_SIX, dev2027: ALL_SIX_DEV }),
      ]),
    );
    const a = toLedgerRows(recs, 2027).rows;
    const b = toLedgerRows([...recs, ...recs], 2027).rows;
    const keyOf = (r: (typeof a)[number]) =>
      `${r.academic_year}|${r.university_name}|${r.work_kind}|${r.subtype}|${r.role}`;
    expect(new Set(b.map(keyOf)).size).toBe(b.length);
    expect(b.length).toBe(a.length);
  });
});
