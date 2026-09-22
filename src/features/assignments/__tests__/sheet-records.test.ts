import { describe, it, expect } from "vitest";
import { recordsFromSheets, type AssignmentSheets } from "../sheet-records";
import { BAEJUNG_CURRENT_YEAR, BAEJUNG_PREV_YEAR } from "../parse";
import { toLedgerRows } from "../import";
import type { AssignmentSheet } from "../schemas";

/**
 * 시트 → 레코드. **어느 칸을 읽을지가 학년도로 갈린다.**
 *
 * 헤더 좌표는 라이브 실측(2026-09-22)이다. 특히 `04. PIMS` 는 `운영자 FULL`(6) ·
 * `접수운영자`(7) · `운영자 환/충`(8) · `前 운영자`(9) 네 칸이 나란히 있어,
 * 정규식이 앞 칸을 먼저 집으면 **작년 자리에 올해 이름이 적재된다** — 에러는 없다.
 */

function sheet(
  name: string,
  head: string[],
  ...rows: string[][]
): AssignmentSheet {
  return {
    worksheetName: name,
    rowsText: [head, ...rows],
    rowCount: rows.length + 1,
    columnCount: head.length,
  };
}

/** 헤더 한 줄을 실측 좌표로 놓는다. */
function head(cols: Record<number, string>, width: number): string[] {
  const r = Array.from({ length: width }, () => "");
  for (const [i, v] of Object.entries(cols)) r[Number(i)] = v;
  return r;
}
function row(cols: Record<number, string>, width: number): string[] {
  return head(cols, width);
}

/** 02 는 블록 구조라 r0/r1 두 줄이 헤더다. */
const baejung = sheet(
  "02. 배정리스트",
  head(
    {
      1: "대분류",
      3: "대학명",
      12: `${BAEJUNG_CURRENT_YEAR}학년도 운영자`,
      18: `${BAEJUNG_CURRENT_YEAR}학년도 개발자`,
      24: `${BAEJUNG_PREV_YEAR}학년도 운영자`,
      30: `${BAEJUNG_PREV_YEAR}학년도 개발자`,
    },
    39,
  ),
  head({ 13: "수시", 19: "수시", 25: "수시", 31: "수시" }, 39),
  row({ 3: "가대학교", 13: "올해운영", 19: "올해개발", 25: "작년운영" }, 39),
);

const grad = sheet(
  "03. 대학원",
  head(
    { 1: "대학명", 7: "운영자", 8: "개발자", 9: "前 운영자", 10: "前 개발자" },
    16,
  ),
  row(
    {
      1: "나대학교",
      7: "올해운영",
      8: "올해개발",
      9: "작년운영",
      10: "작년개발",
    },
    16,
  ),
);

const pims = sheet(
  "04. PIMS",
  head(
    {
      3: "대학명",
      6: "운영자 FULL",
      7: "접수운영자",
      8: "운영자 환/충",
      9: "前 운영자",
    },
    21,
  ),
  row(
    { 3: "다대학교", 6: "올해풀", 7: "접수사람", 8: "올해환", 9: "작년운영" },
    21,
  ),
);

const sungjuk = sheet(
  "06. 성적산출",
  head(
    { 1: "대학명", 4: "운영자", 5: "개발자", 9: "前 운영자", 10: "前 개발자" },
    14,
  ),
  row(
    {
      1: "라대학교",
      4: "올해운영",
      5: "올해개발",
      9: "작년운영",
      10: "작년개발",
    },
    14,
  ),
);

const sangdam = sheet(
  "07. 상담앱",
  head(
    { 1: "학교명", 5: "운영자", 6: "개발자", 7: "前 운영자", 8: "前 개발자" },
    26,
  ),
  row(
    { 1: "마학교", 5: "올해운영", 6: "올해개발", 7: "작년운영", 8: "작년개발" },
    26,
  ),
);

const ALL: AssignmentSheets = {
  배정리스트: baejung,
  대학원: grad,
  PIMS: pims,
  성적산출: sungjuk,
  상담앱: sangdam,
};

const EMPTY: AssignmentSheets = {
  배정리스트: null,
  대학원: null,
  PIMS: null,
  성적산출: null,
  상담앱: null,
};

const names = (recs: { operator: string; developer: string }[]) =>
  recs.flatMap((r) => [r.operator, r.developer]).filter((v) => v !== "");

describe("recordsFromSheets — 올해", () => {
  it("다섯 시트를 모두 읽는다", () => {
    const recs = recordsFromSheets(ALL, BAEJUNG_CURRENT_YEAR);

    expect(recs.map((r) => r.service).sort()).toEqual([
      "PIMS",
      "대학원",
      "상담앱",
      "성적산출",
      "원서접수",
    ]);
  });

  it("작년 이름이 하나도 섞이지 않는다", () => {
    expect(names(recordsFromSheets(ALL, BAEJUNG_CURRENT_YEAR))).not.toContain(
      "작년운영",
    );
  });

  it("PIMS 는 FULL·환충 두 칸을 하위유형으로 담는다 — 접힌 대표값으로는 하나가 사라진다", () => {
    const rec = recordsFromSheets(ALL, BAEJUNG_CURRENT_YEAR).find(
      (r) => r.service === "PIMS",
    );

    expect(rec?.subtypes).toEqual([
      { label: "FULL", operator: "올해풀", developer: "" },
      { label: "환충", operator: "올해환", developer: "" },
    ]);
  });
});

describe("recordsFromSheets — 전년도", () => {
  it("`前` 칸을 읽는다 — 다섯 시트 모두 전년도 배정을 들고 있다", () => {
    const recs = recordsFromSheets(ALL, BAEJUNG_PREV_YEAR);

    expect(recs.map((r) => r.service).sort()).toEqual([
      "PIMS",
      "대학원",
      "상담앱",
      "성적산출",
      "원서접수",
    ]);
    expect(names(recs)).toContain("작년운영");
  });

  it("올해 이름이 하나도 섞이지 않는다 — 섞이면 작년 배정이 거짓이 된다", () => {
    const got = names(recordsFromSheets(ALL, BAEJUNG_PREV_YEAR));

    expect(got).not.toContain("올해운영");
    expect(got).not.toContain("올해개발");
    expect(got).not.toContain("올해풀");
    expect(got).not.toContain("올해환");
  });

  it("PIMS 전년도는 `접수운영자` 를 집지 않는다 — `前 운영자` 앞에 세 칸이 있다", () => {
    const rec = recordsFromSheets(ALL, BAEJUNG_PREV_YEAR).find(
      (r) => r.service === "PIMS",
    );

    expect(rec?.operator).toBe("작년운영");
    expect(names([rec!])).not.toContain("접수사람");
  });

  it("PIMS 전년도는 하위유형이 없다 — 그래서 원장 한 줄이 된다", () => {
    /*
     * `04` 의 전년도 칸은 한 칸이라 FULL·환충으로 갈라져 있지 않다. 업무종류로
     * 라우팅하면 빈 `subtypes` 를 훑어 **0줄을 조용히 만든다**(`import.ts` 참조).
     */
    const rec = recordsFromSheets(ALL, BAEJUNG_PREV_YEAR).find(
      (r) => r.service === "PIMS",
    );
    expect(rec?.subtypes).toBeUndefined();

    const { rows } = toLedgerRows([rec!], BAEJUNG_PREV_YEAR);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ subtype: "", role: "운영" });
  });

  it("02 는 그 해 블록만 하위유형으로 담는다", () => {
    const rec = recordsFromSheets(ALL, BAEJUNG_PREV_YEAR).find(
      (r) => r.service === "원서접수",
    );

    expect(rec?.subtypes).toEqual([
      { label: "수시", operator: "작년운영", developer: "" },
    ]);
  });
});

describe("recordsFromSheets — 경계", () => {
  it("시트에 없는 학년도는 빈 배열이다 — 없는 열을 올해 칸으로 메우지 않는다", () => {
    /*
     * 이게 없으면 `readSheets(2025)` 가 **올해 칸을 2025 로 적재한다.** 자연키에
     * 학년도가 있어 충돌도 안 나고, 대조는 양쪽이 같은 시트에서 나오니 통과한다.
     */
    expect(recordsFromSheets(ALL, 2025)).toEqual([]);
    expect(recordsFromSheets(ALL, BAEJUNG_CURRENT_YEAR + 1)).toEqual([]);
  });

  it("못 읽은 시트는 건너뛴다 — 하나가 실패해도 나머지는 읽는다", () => {
    const recs = recordsFromSheets(
      { ...EMPTY, 대학원: grad },
      BAEJUNG_CURRENT_YEAR,
    );

    expect(recs.map((r) => r.service)).toEqual(["대학원"]);
  });

  it("다 못 읽으면 빈 배열이다", () => {
    expect(recordsFromSheets(EMPTY, BAEJUNG_CURRENT_YEAR)).toEqual([]);
  });
});
