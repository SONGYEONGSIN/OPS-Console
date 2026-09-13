import { describe, it, expect } from "vitest";
import {
  parseBaejungList,
  parsePims,
  parseSimpleSheet,
  BAEJUNG_CURRENT_YEAR,
} from "../parse";
import type { AssignmentSheet } from "../schemas";
import { toLedgerRows, normalizeUniversityName } from "../import";

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
  r[24] = "2026학년도 운영자";
  r[30] = "2026학년도 개발자";
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

describe("toLedgerRows — 원서접수(02. 배정리스트)", () => {
  it("2027 운영/개발 × 6 하위유형이 12행이 된다", () => {
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

    expect(rows).toHaveLength(12);
    expect(rows.every((r) => r.work_kind === "원서접수")).toBe(true);
    expect(rows.every((r) => r.academic_year === 2027)).toBe(true);
    expect([...new Set(rows.map((r) => r.subtype))].sort()).toEqual(
      [...SUBTYPES].sort(),
    );
    expect(rows.filter((r) => r.role === "운영")).toHaveLength(6);
    expect(rows.filter((r) => r.role === "개발")).toHaveLength(6);
  });

  it("여섯 번째 하위유형은 시트 라벨 그대로 '백업자' 다", () => {
    const recs = parseBaejungList(
      sheet02([dataRow("서울대학교", { op2027: { 백업자: "바운영" } })]),
    );
    const { rows } = toLedgerRows(recs, 2027);
    expect(rows.map((r) => r.subtype)).toEqual(["백업자"]);
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

  it("둘 다 같은 사람이면 모호하다고 보고한다 — 추측해 채우지 않는다", () => {
    // 라이브 시트에는 두 칸이 동시에 채워진 행이 0건이다(2026-09-13 실측 72/10/0/0).
    // 파서가 `operator = full || hwan` 으로 접어 주므로 그때는 FULL 이 비었는지
    // 같은 사람인지 구분할 수 없다. 발명하지 말고 대조에 싣는다.
    const { rows, issues } = toLedgerRows(
      parsePims(
        pimsSheet([{ uni: "서울대학교", full: "가운영", hwan: "가운영" }]),
      ),
      2027,
    );
    expect(rows.map((r) => r.subtype)).toEqual(["환충"]);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      kind: "pims-ambiguous",
      university: "서울대학교",
    });
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
