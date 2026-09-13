import { describe, it, expect } from "vitest";
import { reconcile } from "../import";
import type { LedgerRowDraft } from "../import";

/**
 * 대조는 **화면 교체(PR4) 전의 안전장치**다. 설계 §9.1: "교체 전에 가져오기로
 * 시트 값을 DB에 넣고, 시트 ↔ DB 대조를 통과해야 한다. 대조는 대학 수·칸 수·
 * 칸별 이름 일치까지 본다."
 *
 * 순수 함수로 둔다 — 행 배열 둘을 받으면 DB 가 필요 없고, 불일치를 fixture 로
 * 못 박을 수 있다. 이관이 조용히 일부만 들어가면 PR4 에서 배정이 사라진 것처럼
 * 보이는데, 그때 원인을 여기서 먼저 잡는다.
 */
function row(
  university: string,
  workKind: LedgerRowDraft["work_kind"],
  subtype: string,
  role: LedgerRowDraft["role"],
  assigneeName: string,
): LedgerRowDraft {
  return {
    academic_year: 2027,
    university_name: university,
    work_kind: workKind,
    subtype,
    role,
    assignee_name: assigneeName,
  };
}

const SHEET: LedgerRowDraft[] = [
  row("서울대학교", "원서접수", "수시", "운영", "가운영"),
  row("서울대학교", "원서접수", "수시", "개발", "가개발"),
  row("고려대학교", "PIMS", "FULL", "운영", "나운영"),
];

describe("reconcile — 일치", () => {
  it("같으면 불일치 0건이다", () => {
    const r = reconcile(SHEET, [...SHEET]);
    expect(r.mismatchCount).toBe(0);
    expect(r.missingInLedger).toEqual([]);
    expect(r.extraInLedger).toEqual([]);
    expect(r.nameMismatch).toEqual([]);
  });

  it("대학 수와 칸 수를 양쪽에서 센다", () => {
    const r = reconcile(SHEET, [...SHEET]);
    expect(r.universities).toEqual({ sheet: 2, ledger: 2 });
    expect(r.cells).toEqual({ sheet: 3, ledger: 3 });
  });

  it("행 순서가 달라도 일치로 본다 — 자연키로 대조한다", () => {
    const r = reconcile(SHEET, [...SHEET].reverse());
    expect(r.mismatchCount).toBe(0);
  });
});

describe("reconcile — 불일치", () => {
  it("시트에만 있는 칸을 missingInLedger 로 센다 — 이관이 일부만 들어간 경우", () => {
    const ledger = SHEET.slice(0, 2);
    const r = reconcile(SHEET, ledger);
    expect(r.missingInLedger).toHaveLength(1);
    expect(r.missingInLedger[0]).toContain("고려대학교");
    expect(r.mismatchCount).toBe(1);
  });

  it("원장에만 있는 칸을 extraInLedger 로 센다 — 손으로 넣은 흔적", () => {
    const ledger = [
      ...SHEET,
      row("연세대학교", "대학원", "", "운영", "다운영"),
    ];
    const r = reconcile(SHEET, ledger);
    expect(r.extraInLedger).toHaveLength(1);
    expect(r.extraInLedger[0]).toContain("연세대학교");
    expect(r.mismatchCount).toBe(1);
  });

  it("같은 칸에 이름이 다르면 nameMismatch 로 센다", () => {
    const ledger = [
      row("서울대학교", "원서접수", "수시", "운영", "다른사람"),
      ...SHEET.slice(1),
    ];
    const r = reconcile(SHEET, ledger);
    expect(r.nameMismatch).toHaveLength(1);
    expect(r.nameMismatch[0]).toMatchObject({
      sheet: "가운영",
      ledger: "다른사람",
    });
    expect(r.mismatchCount).toBe(1);
    // 칸 자체는 양쪽에 있으므로 없어진 칸으로 세지 않는다.
    expect(r.missingInLedger).toEqual([]);
    expect(r.extraInLedger).toEqual([]);
  });

  it("불일치가 여러 종류면 모두 합해 센다", () => {
    const ledger = [
      row("서울대학교", "원서접수", "수시", "운영", "다른사람"),
      row("연세대학교", "대학원", "", "운영", "다운영"),
    ];
    const r = reconcile(SHEET, ledger);
    // 이름 1 + 시트에만 2(수시 개발 · 고려대 PIMS) + 원장에만 1(연세대)
    expect(r.mismatchCount).toBe(4);
  });

  it("빈 원장이면 시트 전부가 미적재로 나온다", () => {
    const r = reconcile(SHEET, []);
    expect(r.missingInLedger).toHaveLength(3);
    expect(r.mismatchCount).toBe(3);
    expect(r.universities).toEqual({ sheet: 2, ledger: 0 });
  });

  it("양쪽이 비면 불일치 0건이다 — 아무것도 없는 것은 어긋난 것이 아니다", () => {
    const r = reconcile([], []);
    expect(r.mismatchCount).toBe(0);
    expect(r.cells).toEqual({ sheet: 0, ledger: 0 });
  });
});

describe("reconcile — 학년도", () => {
  it("학년도가 다른 칸은 다른 칸이다", () => {
    const ledger = [{ ...SHEET[0], academic_year: 2026 }, ...SHEET.slice(1)];
    const r = reconcile(SHEET, ledger);
    expect(r.missingInLedger).toHaveLength(1);
    expect(r.extraInLedger).toHaveLength(1);
    expect(r.mismatchCount).toBe(2);
  });
});
