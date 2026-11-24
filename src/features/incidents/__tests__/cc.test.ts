import { describe, it, expect } from "vitest";
import type { AssignmentSheet } from "@/features/assignments/schemas";
import { findUniversitySales, pickIncidentCc, type CcOperator } from "../cc";

// 02. 배정리스트 실제 머리줄 모양 — r0 라벨, r1 하위유형, r2~ 데이터.
const sheet: AssignmentSheet = {
  worksheetName: "02. 배정리스트",
  rowsText: [
    ["NO", "대분류", "지역(구분)", "대학명", "UnivID", "영업자", "단독여부"],
    ["", "", "", "", "", "", "수시"],
    ["", "4년제", "충남", "한서대학교", "1160", "윤영호", "단"],
    ["", "4년제", "서울", "동국대학교(서울)", "1", "김은호", ""],
    ["", "4년제", "전남", "세한대학교", "1047", "", ""],
    ["", "전문대학", "경기", "경복대학교", "2", "이창욱", ""],
  ],
  rowCount: 6,
  columnCount: 7,
};

const op = (o: Partial<CcOperator>): CcOperator => ({
  email: "x@jinhakapply.com",
  name: "x",
  team: "운영1팀",
  role: "매니저",
  status: "active",
  ...o,
});

const 이사 = op({ email: "llh@jinhak.com", name: "이이화", role: "이사" });
const 윤영호 = op({
  email: "yyh@jinhakapply.com",
  name: "윤영호",
  team: "영업팀",
});
const 이창욱 = op({
  email: "lcw@jinhakapply.com",
  name: "이창욱",
  team: "영업팀",
});
const operators = [
  이사,
  윤영호,
  이창욱,
  op({ email: "a@j.com", name: "허승철", role: "부장" }),
];

describe("findUniversitySales — 배정리스트에서 대학의 대분류·영업자", () => {
  it("대학명으로 대분류와 영업자를 찾는다", () => {
    expect(findUniversitySales(sheet, "한서대학교")).toEqual({
      universityType: "4년제",
      salesName: "윤영호",
    });
  });

  it("앞뒤·연속 공백은 다듬어 맞춘다", () => {
    expect(findUniversitySales(sheet, " 동국대학교(서울) ")?.salesName).toBe(
      "김은호",
    );
  });

  it("시트에 없는 대학은 null", () => {
    expect(findUniversitySales(sheet, "없는대학교")).toBeNull();
  });

  it("영업자 칸이 없는 시트면 null — 칸을 못 찾았는데 '영업자 없음' 으로 읽지 않는다", () => {
    const noSales = {
      ...sheet,
      rowsText: sheet.rowsText.map((r) => r.slice(0, 5)),
    };
    expect(findUniversitySales(noSales, "한서대학교")).toBeNull();
  });
});

describe("pickIncidentCc — 4년제만 이사님·영업자 참조", () => {
  it("4년제면 이사님과 그 대학 영업자", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "윤영호" },
      operators,
      reporterEmail: "a@j.com",
    });
    expect(r.cc).toEqual([
      { email: "llh@jinhak.com", name: "이이화" },
      { email: "yyh@jinhakapply.com", name: "윤영호" },
    ]);
    expect(r.unmatchedSales).toBeNull();
  });

  it("이사님은 메일 참조 제외 표시가 있어도 넣는다 — 사고보고 4년제만의 예외(사용자 지시 2026-11-24)", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "" },
      operators: [{ ...이사, mail_cc_excluded: true } as CcOperator],
      reporterEmail: "a@j.com",
    });
    expect(r.cc.map((c) => c.email)).toEqual(["llh@jinhak.com"]);
  });

  it("4년제가 아니면 아무도 안 넣는다", () => {
    const r = pickIncidentCc({
      sales: { universityType: "전문대학", salesName: "이창욱" },
      operators,
      reporterEmail: "a@j.com",
    });
    expect(r.cc).toEqual([]);
  });

  it("시트에서 못 찾은 대학이면 아무도 안 넣는다", () => {
    expect(
      pickIncidentCc({ sales: null, operators, reporterEmail: "a@j.com" }).cc,
    ).toEqual([]);
  });

  it("영업자 칸이 비면 이사님만", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "" },
      operators,
      reporterEmail: "a@j.com",
    });
    expect(r.cc.map((c) => c.name)).toEqual(["이이화"]);
    expect(r.unmatchedSales).toBeNull();
  });

  it("영업자가 조직권한 영업팀에 없으면 이사님만 넣고 그 이름을 알린다", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "김은호" },
      operators,
      reporterEmail: "a@j.com",
    });
    expect(r.cc.map((c) => c.name)).toEqual(["이이화"]);
    expect(r.unmatchedSales).toBe("김은호");
  });

  it("같은 이름이라도 영업팀이 아니거나 비활성이면 영업자로 안 본다", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "윤영호" },
      operators: [
        이사,
        { ...윤영호, team: "운영1팀" },
        { ...윤영호, email: "old@j.com", status: "deleted" },
      ],
      reporterEmail: "a@j.com",
    });
    expect(r.cc.map((c) => c.name)).toEqual(["이이화"]);
    expect(r.unmatchedSales).toBe("윤영호");
  });

  it("비활성 이사는 넣지 않는다", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "" },
      operators: [{ ...이사, status: "deleted" }],
      reporterEmail: "a@j.com",
    });
    expect(r.cc).toEqual([]);
  });

  it("받는 사람(보고자)과 겹치면 참조에서 뺀다", () => {
    const r = pickIncidentCc({
      sales: { universityType: "4년제", salesName: "윤영호" },
      operators,
      reporterEmail: "llh@jinhak.com",
    });
    expect(r.cc.map((c) => c.name)).toEqual(["윤영호"]);
  });
});
