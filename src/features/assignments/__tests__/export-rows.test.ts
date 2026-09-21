import { describe, it, expect } from "vitest";
import {
  EXPORT_SHEET_NAME,
  EXPORT_WARNING,
  buildExportColumns,
  buildExportGrid,
  pickExportYears,
} from "../export-rows";
import type { LedgerRow } from "../import";

/**
 * 내보내기 조립은 **순수 함수**다 — Graph 를 부르지 않으므로 여기에 시험을 몰았다.
 * 쓰기(`export-write.ts`)는 이 배열을 한 번에 PATCH 하는 얇은 층이다.
 *
 * 기대값은 원장 1,858행 실측(2026-09-21)에서 왔다:
 * PIMS 는 `FULL 71 / 환충 10` 이고 **개발 0건**, 원서접수는 다섯 하위유형뿐,
 * 학년도는 2027 하나다. 시트에 있는 `백업자` 는 `parse.ts` 가 원장에서 가른다.
 */
function row(overrides: Partial<LedgerRow> = {}): LedgerRow {
  return {
    academic_year: 2027,
    university_name: "서울대학교",
    work_kind: "원서접수",
    subtype: "수시",
    role: "운영",
    assignee_email: "op@jinhak.com",
    assignee_name: "나운영",
    university_type: "4년제",
    ...overrides,
  };
}

/** r1(하위유형 줄)에서 한 블록의 칸 라벨만 뽑는다. */
function subsOf(cols: ReturnType<typeof buildExportColumns>, top: string) {
  const start = cols.findIndex((c) => c.top === top);
  expect(start).toBeGreaterThanOrEqual(0);
  const out: string[] = [];
  for (let i = start; i < cols.length; i++) {
    if (i > start && cols[i].top !== "") break;
    out.push(cols[i].sub);
  }
  return out;
}

describe("buildExportColumns", () => {
  it("PIMS 는 FULL·환충 2칸이고 개발 열이 없다 — 원장에 PIMS 개발이 0건이다", () => {
    const cols = buildExportColumns([2027]);
    expect(subsOf(cols, "PIMS")).toEqual(["FULL", "환충"]);
    const pims = cols.filter(
      (c) => c.kind === "cell" && c.work_kind === "PIMS",
    );
    expect(pims).toHaveLength(2);
    expect(pims.every((c) => c.kind === "cell" && c.role === "운영")).toBe(true);
  });

  it("원서접수는 5칸이고 백업자 열이 없다 — 원장이 백업자를 담지 않는다", () => {
    const cols = buildExportColumns([2027]);
    expect(subsOf(cols, "2027 운영자")).toEqual([
      "재외",
      "수시",
      "정시",
      "편입",
      "외국인",
    ]);
    expect(subsOf(cols, "2027 개발자")).toHaveLength(5);
    expect(
      cols.some((c) => c.sub === "백업자" || c.sub === "백업"),
    ).toBe(false);
  });

  it("원서접수 외 3종은 운영·개발 2칸이다", () => {
    const cols = buildExportColumns([2027]);
    expect(subsOf(cols, "대학원")).toEqual(["운영", "개발"]);
    expect(subsOf(cols, "성적산출")).toEqual(["운영", "개발"]);
    expect(subsOf(cols, "상담앱")).toEqual(["운영", "개발"]);
  });

  it("학년도가 둘이면 원서접수 블록이 두 벌이고 최신이 먼저다", () => {
    const cols = buildExportColumns([2027, 2026]);
    const tops = cols.map((c) => c.top).filter((t) => t !== "");
    expect(tops).toEqual([
      "대학명",
      "대분류",
      "2027 운영자",
      "2027 개발자",
      "2026 운영자",
      "2026 개발자",
      "대학원",
      "PIMS",
      "성적산출",
      "상담앱",
    ]);
  });
});

describe("pickExportYears", () => {
  it("원장에 있는 학년도만 최신순으로 최대 2개", () => {
    expect(pickExportYears([row({ academic_year: 2027 })])).toEqual([2027]);
    expect(
      pickExportYears([
        row({ academic_year: 2025 }),
        row({ academic_year: 2027 }),
        row({ academic_year: 2026 }),
      ]),
    ).toEqual([2027, 2026]);
  });

  it("행이 없으면 학년도도 없다", () => {
    expect(pickExportYears([])).toEqual([]);
  });
});

describe("buildExportGrid", () => {
  it("원장에 없는 학년도의 열을 만들지 않는다 — 빈 20칸은 '배정이 비었다'는 거짓말이 된다", () => {
    const grid = buildExportGrid([row({ academic_year: 2027 })]);
    const tops = grid[1];
    expect(tops).toContain("2027 운영자");
    expect(tops.some((t) => t.startsWith("2026"))).toBe(false);
  });

  it("1행에 경고를 박는다", () => {
    const grid = buildExportGrid([row()]);
    expect(grid[0][0]).toBe(EXPORT_WARNING);
    expect(grid[0].slice(1).every((c) => c === "")).toBe(true);
  });

  it("한 대학이 한 행이고, 담당자 없는 칸은 빈 문자열", () => {
    const grid = buildExportGrid([
      row({ university_name: "서울대학교", subtype: "수시", assignee_name: "나운영" }),
      row({
        university_name: "서울대학교",
        subtype: "수시",
        role: "개발",
        assignee_email: null,
        assignee_name: "김개발",
      }),
      row({ university_name: "고려대학교", subtype: "정시", assignee_name: "이운영" }),
    ]);
    const cols = buildExportColumns([2027]);
    const dataRows = grid.slice(3);
    expect(dataRows).toHaveLength(2);
    expect(dataRows.map((r) => r[0])).toEqual(["고려대학교", "서울대학교"]);

    const seoul = dataRows[1];
    const opSusi = cols.findIndex(
      (c) => c.kind === "cell" && c.top === "2027 운영자" && c.sub === "수시",
    );
    const devSusi = cols.findIndex(
      (c) => c.kind === "cell" && c.top === "2027 개발자" && c.sub === "수시",
    );
    const opJeongsi = cols.findIndex(
      (c) => c.kind === "cell" && c.top === "2027 운영자" && c.sub === "정시",
    );
    expect(seoul[opSusi]).toBe("나운영");
    expect(seoul[devSusi]).toBe("김개발");
    expect(seoul[opJeongsi]).toBe("");
  });

  it("대분류를 싣는다", () => {
    const grid = buildExportGrid([
      row({ university_name: "서울과학기술대", university_type: "4년제" }),
    ]);
    expect(grid[3][1]).toBe("4년제");
  });

  it("모든 행의 길이가 열 수와 같다 — Graph range 는 직사각형만 받는다", () => {
    const grid = buildExportGrid([
      row({ academic_year: 2027, university_name: "가대학교" }),
      row({
        academic_year: 2026,
        university_name: "나대학교",
        work_kind: "PIMS",
        subtype: "FULL",
      }),
    ]);
    const width = buildExportColumns([2027, 2026]).length;
    expect(grid.every((r) => r.length === width)).toBe(true);
    expect(grid).toHaveLength(3 + 2);
  });

  it("원장에 백업자 행이 남아 있어도 열이 없으므로 실리지 않는다", () => {
    const grid = buildExportGrid([
      row({ subtype: "백업자", assignee_name: "백업만" }),
      row({ subtype: "수시", assignee_name: "나운영" }),
    ]);
    expect(grid.flat()).not.toContain("백업만");
  });

  it("행이 하나도 없으면 머리글 3줄만 나온다 — 시트를 비우는 것도 결과다", () => {
    const grid = buildExportGrid([]);
    expect(grid).toHaveLength(3);
    expect(grid[0][0]).toBe(EXPORT_WARNING);
    expect(grid[1][0]).toBe("대학명");
  });
});

describe("상수", () => {
  it("앱 전용 시트 이름은 번호를 붙이지 않는다 — 05·08 과 충돌한다", () => {
    expect(EXPORT_SHEET_NAME).toBe("(앱) 배정확정");
  });
});
