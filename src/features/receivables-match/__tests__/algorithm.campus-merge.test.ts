import { describe, it, expect } from "vitest";
import { runMatch } from "../algorithm";
import { normalizeName, baseName } from "../normalize";
import type { MisuRow, DepositRow } from "../types";

/**
 * 캠퍼스 통합 N:M — 캠퍼스(성남/의정부)로 분리된 미수가 base 대학명 입금 1건과 매칭.
 *
 * 미수 3건: 을지대학교(성남) 140,000 + 을지대학교(성남) 125,000 + 을지대학교(의정부) 10,000
 * 입금 1건: 을지대학교 275,000
 *
 * normalizeName은 "(성남)"/"(의정부)" 접미사를 보존하므로 캠퍼스별로 분리된다.
 * baseName으로 접미사를 제거해 base 대학명("을지대")이 같으면 합산 매칭한다.
 */
describe("baseName — 캠퍼스 접미사 제거", () => {
  it("normalizeName은 캠퍼스 접미사를 보존한다", () => {
    expect(normalizeName("을지대학교(성남)")).toBe("을지대(성남)");
    expect(normalizeName("을지대학교(의정부)")).toBe("을지대(의정부)");
  });

  it("baseName은 캠퍼스 접미사를 제거해 동일 키가 된다", () => {
    expect(baseName("을지대학교(성남)")).toBe("을지대");
    expect(baseName("을지대학교(의정부)")).toBe("을지대");
  });

  it("선두 괄호((학)단국대)는 base에서 보존한다", () => {
    expect(baseName("단국대")).toBe("(학)단국대");
  });
});

describe("runMatch — 캠퍼스 통합 N:M", () => {
  it("캠퍼스 분리 미수 3건이 base 대학명 입금 1건과 매칭", () => {
    const misu: MisuRow[] = [
      {
        rowNumber: 2,
        date: "2026-05-20",
        customer: "을지대학교(성남)",
        amount: 140000,
        note: "",
      },
      {
        rowNumber: 3,
        date: "2026-05-20",
        customer: "을지대학교(성남)",
        amount: 125000,
        note: "",
      },
      {
        rowNumber: 4,
        date: "2026-05-20",
        customer: "을지대학교(의정부)",
        amount: 10000,
        note: "",
      },
    ];
    const deposits: DepositRow[] = [
      {
        row: 10,
        date: "2026-05-21",
        amount: 275000,
        content: "을지대학교",
        matchedFlag: "",
      },
    ];

    const r = runMatch(misu, deposits);

    expect(r.matched.length).toBe(1);
    expect(r.matched[0].misuRows.sort()).toEqual([2, 3, 4]);
    expect(r.matched[0].depRows).toEqual([10]);
    expect(r.matched[0].kind).toBe("nToM");
    expect(r.matched[0].amount).toBe(275000);
    expect(r.unmatchedMisu.length).toBe(0);
    expect(r.unmatchedDep.length).toBe(0);
  });

  it("회귀 방지 — 성남만 합산 입금되면 기존 N:1이 먼저 잡고, 의정부는 미매칭으로 남는다", () => {
    const misu: MisuRow[] = [
      {
        rowNumber: 2,
        date: "2026-05-20",
        customer: "을지대학교(성남)",
        amount: 140000,
        note: "",
      },
      {
        rowNumber: 3,
        date: "2026-05-20",
        customer: "을지대학교(성남)",
        amount: 125000,
        note: "",
      },
      {
        rowNumber: 4,
        date: "2026-05-20",
        customer: "을지대학교(의정부)",
        amount: 10000,
        note: "",
      },
    ];
    // 성남 2건 합(265,000)만 입금 — 의정부 입금은 아직 없음.
    const deposits: DepositRow[] = [
      {
        row: 10,
        date: "2026-05-21",
        amount: 265000,
        content: "을지대학교",
        matchedFlag: "",
      },
    ];

    const r = runMatch(misu, deposits);

    expect(r.matched.length).toBe(1);
    expect(r.matched[0].misuRows.sort()).toEqual([2, 3]);
    expect(r.matched[0].kind).toBe("nToOne");
    expect(r.unmatchedMisu).toEqual([4]); // 의정부 미매칭 보존
  });
});
