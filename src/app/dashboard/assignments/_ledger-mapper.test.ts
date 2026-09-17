import { describe, it, expect } from "vitest";
import {
  ledgerRowsToListRows,
  isMyLedgerAssignment,
  matchesLedgerQuery,
} from "./_ledger-mapper";
import type { LedgerRow } from "@/features/assignments/import";

/**
 * 원장 행 → `ListRow`. **시트 타입(`AssignmentRecord`)을 거치지 않는다.**
 *
 * 거쳐 가면 파서의 대표값 규칙을 화면 쪽에서 되만들어야 하고, 그게 곧 두 번째
 * 진실 공급원이다 — PIMS 접힘(#1193)이 정확히 그 실수였다. 그래서 `cells` 를
 * 자연키 단위로 들고, 대표값·하위유형은 **거기서 파생**시킨다.
 */
const cell = (o: Partial<LedgerRow> = {}): LedgerRow => ({
  academic_year: 2027,
  university_name: "서울대학교",
  work_kind: "대학원",
  subtype: "",
  role: "운영",
  assignee_name: "가운영",
  assignee_email: "a@x.com",
  ...o,
});

describe("ledgerRowsToListRows", () => {
  it("같은 대학의 여러 칸이 한 행으로 모인다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "대학원" }),
      cell({ work_kind: "PIMS", subtype: "FULL" }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("서울대학교");
    expect(rows[0].name).toBe("서울대학교");
    expect(Object.keys(rows[0].assignment!.byService).sort()).toEqual([
      "PIMS",
      "대학원",
    ]);
  });

  it("대학이 다르면 행이 갈리고 대학명 순으로 정렬된다", () => {
    const rows = ledgerRowsToListRows([
      cell({ university_name: "한양대학교" }),
      cell({ university_name: "가천대학교" }),
    ]);
    expect(rows.map((r) => r.name)).toEqual(["가천대학교", "한양대학교"]);
  });

  it("자연키 단위 칸이 cells 에 그대로 남는다 — 편집이 여기에 붙는다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "PIMS", subtype: "FULL", assignee_name: "가운영" }),
      cell({
        work_kind: "PIMS",
        subtype: "환충",
        assignee_name: "나운영",
        assignee_email: null,
      }),
    ]);
    expect(rows[0].assignment!.byService["PIMS"].cells).toEqual([
      { subtype: "FULL", role: "운영", name: "가운영", email: "a@x.com" },
      { subtype: "환충", role: "운영", name: "나운영", email: null },
    ]);
  });

  it("하위유형은 cells 에서 파생된다 — 빈 subtype 은 항목이 되지 않는다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "PIMS", subtype: "FULL", assignee_name: "가운영" }),
      cell({ work_kind: "PIMS", subtype: "환충", assignee_name: "나운영" }),
    ]);
    expect(rows[0].assignment!.byService["PIMS"].subtypes).toEqual([
      { label: "FULL", operator: "가운영", developer: "" },
      { label: "환충", operator: "나운영", developer: "" },
    ]);
  });

  /**
   * 설계 §3.1 이 적은 시트 순서다. DB 조회 순서는 보장이 없어 정하지 않으면 화면
   * 줄 순서가 실행마다 바뀐다. 가나다순으로 두면 `재외/수시/정시` 가 뒤집힌다.
   */
  it("하위유형 순서는 시트 순서다 — 입력 순서나 가나다순이 아니다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "원서접수", subtype: "정시", assignee_name: "C" }),
      cell({ work_kind: "원서접수", subtype: "재외", assignee_name: "A" }),
      cell({ work_kind: "원서접수", subtype: "수시", assignee_name: "B" }),
    ]);
    expect(
      rows[0].assignment!.byService["원서접수"].subtypes!.map((s) => s.label),
    ).toEqual(["재외", "수시", "정시"]);
  });

  it("모르는 하위유형은 아는 것들 뒤에 가나다순으로 붙는다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "원서접수", subtype: "하늘길", assignee_name: "Z" }),
      cell({ work_kind: "원서접수", subtype: "가나다", assignee_name: "Y" }),
      cell({ work_kind: "원서접수", subtype: "수시", assignee_name: "B" }),
    ]);
    expect(
      rows[0].assignment!.byService["원서접수"].subtypes!.map((s) => s.label),
    ).toEqual(["수시", "가나다", "하늘길"]);
  });

  it("운영·개발이 한 하위유형 항목으로 합쳐진다", () => {
    const rows = ledgerRowsToListRows([
      cell({
        work_kind: "원서접수",
        subtype: "수시",
        role: "운영",
        assignee_name: "가운영",
      }),
      cell({
        work_kind: "원서접수",
        subtype: "수시",
        role: "개발",
        assignee_name: "가개발",
      }),
    ]);
    expect(rows[0].assignment!.byService["원서접수"].subtypes).toEqual([
      { label: "수시", operator: "가운영", developer: "가개발" },
    ]);
  });

  /**
   * 대표값은 **빈 subtype 칸에서만** 온다. 하위유형이 있는 업무에서 하나를 골라
   * 대표로 삼으면 그게 곧 접힘이고, 접힌 값을 배정의 단위로 쓰는 실수가 #1193 이다.
   * 하위유형이 있는 칸은 `Table` 이 줄로 그리므로 대표값이 필요 없다.
   */
  it("대표 operator·developer 는 빈 subtype 칸에서만 온다", () => {
    const rows = ledgerRowsToListRows([
      cell({
        work_kind: "대학원",
        subtype: "",
        role: "운영",
        assignee_name: "가운영",
      }),
      cell({
        work_kind: "대학원",
        subtype: "",
        role: "개발",
        assignee_name: "가개발",
      }),
    ]);
    const rec = rows[0].assignment!.byService["대학원"];
    expect(rec.operator).toBe("가운영");
    expect(rec.developer).toBe("가개발");
    expect(rec.subtypes).toEqual([]);
  });

  it("하위유형만 있는 업무는 대표값이 빈 문자열이다 — 하나를 골라 접지 않는다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "PIMS", subtype: "FULL", assignee_name: "가운영" }),
    ]);
    const rec = rows[0].assignment!.byService["PIMS"];
    expect(rec.operator).toBe("");
    expect(rec.developer).toBe("");
  });

  it("대분류 스냅샷을 행에 올린다", () => {
    const rows = ledgerRowsToListRows([cell({ university_type: "일반대" })]);
    expect(rows[0].universityType).toBe("일반대");
  });

  /**
   * 배지는 **대학 단위**다 — 설계 §3.1 의 "여러 운영자로 갈린 대학 44곳"이 그 단위다.
   * PR6 게이트 G4 도 대학 단위로 분할을 뺀다.
   */
  it("배지는 대학의 모든 칸을 보고 붙는다", () => {
    const rows = ledgerRowsToListRows([
      cell({ work_kind: "대학원", assignee_name: "가운영" }),
      cell({ work_kind: "PIMS", subtype: "FULL", assignee_name: "나운영" }),
    ]);
    expect(rows[0].assignment!.badges).toEqual(["분할"]);
  });

  it("학년도를 행에 남긴다 — 편집이 자연키를 되만들어야 한다", () => {
    const rows = ledgerRowsToListRows([cell({ academic_year: 2027 })]);
    expect(rows[0].assignment!.academicYear).toBe(2027);
  });
});

/**
 * **`내 배정` 의 단위는 이메일이다.**
 *
 * 지금(PR3까지)은 `me.displayName` 과 시트 이름을 문자열 비교했다. 오늘 실측으로는
 * 새지 않는다 — 활성 운영자 21명 중 겹치는 이름이 0이고 원장에서 한 이름이 두
 * 이메일에 걸린 경우도 0이다. 다만 비활성 포함 22명에는 동명이인이 한 쌍 있어,
 * 그 사람이 복직하거나 같은 이름의 신입이 들어오면 **그날 조용히 남의 배정이 뜬다.**
 * 원장에 이미 이메일이 있으니 덜 정확한 키를 쓸 이유가 없다.
 */
describe("isMyLedgerAssignment", () => {
  const row = (...cells: Partial<LedgerRow>[]) =>
    ledgerRowsToListRows(cells.map((c) => cell(c)))[0];

  it("이메일이 같으면 내 배정이다", () => {
    expect(isMyLedgerAssignment(row({}), "a@x.com")).toBe(true);
  });

  it("이름만 같고 이메일이 다르면 내 배정이 아니다 — 동명이인", () => {
    expect(
      isMyLedgerAssignment(
        row({ assignee_name: "가운영", assignee_email: "other@x.com" }),
        "a@x.com",
      ),
    ).toBe(false);
  });

  it("이메일이 없는 칸은 누구의 배정으로도 잡히지 않는다", () => {
    expect(isMyLedgerAssignment(row({ assignee_email: null }), "a@x.com")).toBe(
      false,
    );
  });

  it("빈 이메일로는 아무것도 잡히지 않는다", () => {
    expect(isMyLedgerAssignment(row({}), "")).toBe(false);
  });

  it("하위유형 칸도 잡는다", () => {
    expect(
      isMyLedgerAssignment(
        row({ work_kind: "PIMS", subtype: "환충", assignee_email: "b@x.com" }),
        "b@x.com",
      ),
    ).toBe(true);
  });

  it("대소문자가 달라도 같은 주소로 본다", () => {
    expect(
      isMyLedgerAssignment(row({ assignee_email: "A@X.com" }), "a@x.com"),
    ).toBe(true);
  });
});

describe("matchesLedgerQuery", () => {
  const row = (...cells: Partial<LedgerRow>[]) =>
    ledgerRowsToListRows(cells.map((c) => cell(c)))[0];

  it("빈 검색어는 모두 통과다", () => {
    expect(matchesLedgerQuery(row({}), "  ")).toBe(true);
  });

  it("대학명으로 찾는다", () => {
    expect(matchesLedgerQuery(row({}), "서울")).toBe(true);
  });

  it("담당자 이름으로 찾는다 — 하위유형 칸도 본다", () => {
    expect(
      matchesLedgerQuery(
        row({ work_kind: "PIMS", subtype: "FULL", assignee_name: "나운영" }),
        "나운영",
      ),
    ).toBe(true);
  });

  /** 이메일을 못 맞춘 칸도 이름은 남아 있다 — 그 이름으로도 찾혀야 한다(설계 F2). */
  it("이메일을 못 맞춘 칸의 이름으로도 찾는다", () => {
    expect(
      matchesLedgerQuery(
        row({ assignee_name: "김없음", assignee_email: null }),
        "김없음",
      ),
    ).toBe(true);
  });

  it("없는 말은 찾히지 않는다", () => {
    expect(matchesLedgerQuery(row({}), "듣도보도못한")).toBe(false);
  });
});
