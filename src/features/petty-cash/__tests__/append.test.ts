import { describe, it, expect } from "vitest";
import { buildSpendRow, nextRowAddress, findDuplicate } from "../append";
import type { PettyCashEntry } from "../parse";

describe("buildSpendRow", () => {
  it("잔액을 계산해 넣는다 — 장부라 그 자리에서 빼야 한다", () => {
    const row = buildSpendRow(
      { date: "2026-08-20", title: "우편물", count: 3, amount: 13290 },
      500000,
    );
    // [전도금內, 청구전, 잔액, 날짜, 내용, 건수, 금액, 품목]
    expect(row[2]).toBe(486710);
    expect(row[3]).toBe("2026-08-20");
    expect(row[6]).toBe(13290);
  });

  it("청구 칸은 비워둔다 — 사용 행이다", () => {
    const row = buildSpendRow(
      { date: "2026-08-20", title: "우편물", count: 1, amount: 100 },
      1000,
    );
    expect(row[0]).toBe("");
    expect(row[1]).toBe("");
  });

  it("품목이 있으면 담는다", () => {
    const row = buildSpendRow(
      { date: "2026-08-20", title: "사무용품", count: 1, amount: 1600, item: "우편박스" },
      1000,
    );
    expect(row[7]).toBe("우편박스");
  });

  it("잔액이 모자라면 음수라도 그대로 적는다 — 숨기면 채워야 할 때를 놓친다", () => {
    const row = buildSpendRow(
      { date: "2026-08-20", title: "우편물", count: 1, amount: 5000 },
      3000,
    );
    expect(row[2]).toBe(-2000);
  });
});

describe("nextRowAddress", () => {
  it("쓰인 마지막 행 다음 줄을 가리킨다", () => {
    // 74행이 쓰였으면 다음은 75행
    expect(nextRowAddress(74)).toBe("A75:H75");
  });

  it("빈 시트면 2행부터 — 1행은 헤더다", () => {
    expect(nextRowAddress(1)).toBe("A2:H2");
  });
});

describe("findDuplicate", () => {
  const entries: PettyCashEntry[] = [
    { kind: "spend", date: "2026-08-18", title: "우편물", count: 3, amount: 13290, item: null, balance: 151020 },
    { kind: "refill", before: 348980, balance: 500000 },
    { kind: "spend", date: "2026-08-19", title: "우편물", count: 2, amount: 8340, item: null, balance: 491660 },
  ];

  /**
   * 엑셀 쓰기는 되돌리기 어렵다. 같은 영수증을 두 번 확정하면 장부에 두 줄이
   * 남고 잔액이 실제와 어긋난다 — 쓰기 전에 같은 것이 있는지 본다.
   */
  it("같은 날짜·금액·건수가 이미 있으면 잡아낸다", () => {
    expect(
      findDuplicate(entries, { date: "2026-08-18", title: "우편물", count: 3, amount: 13290 }),
    ).toBe(true);
  });

  it("금액이 다르면 다른 건이다", () => {
    expect(
      findDuplicate(entries, { date: "2026-08-18", title: "우편물", count: 3, amount: 999 }),
    ).toBe(false);
  });

  it("날짜가 다르면 다른 건이다 — 같은 금액이 다른 날 나올 수 있다", () => {
    expect(
      findDuplicate(entries, { date: "2026-08-20", title: "우편물", count: 2, amount: 8340 }),
    ).toBe(false);
  });

  it("청구 행은 비교 대상이 아니다", () => {
    expect(
      findDuplicate(entries, { date: "", title: "전도금청구", count: null, amount: 500000 }),
    ).toBe(false);
  });
});
