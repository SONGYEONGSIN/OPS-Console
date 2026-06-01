import { describe, it, expect } from "vitest";
import {
  parseDepositSheet,
  depositFetchFailMessage,
} from "../deposit-queries";

describe("depositFetchFailMessage", () => {
  it("item ID 미설정 → 'env 미설정' 안내", () => {
    expect(depositFetchFailMessage(false)).toContain("미설정");
  });
  it("item ID 설정됨 → 'fetch 실패(파일/권한/Graph)' 안내", () => {
    const msg = depositFetchFailMessage(true);
    expect(msg).toContain("설정됨");
    expect(msg).not.toContain("미설정");
  });
});

describe("parseDepositSheet — Graph usedRange 응답 → DepositRow[]", () => {
  it("정상 케이스 — 헤더 1행 + 데이터 2행 → DepositRow 2개", () => {
    const usedRange = {
      values: [
        ["No", "거래일시", "구분", "입금금액", "잔액", "거래내용", "x", "y", "z", "w", "미결제표시"],
        [1, "2026-04-15", "입금", 100000, 5000000, "가천대", "", "", "", "", ""],
        [2, "2026-04-16", "입금", 50000, 5050000, "동국대", "", "", "", "", "처리완료"],
      ],
      text: [
        ["No", "거래일시", "구분", "입금금액", "잔액", "거래내용", "x", "y", "z", "w", "미결제표시"],
        ["1", "2026-04-15", "입금", "100,000", "5,000,000", "가천대", "", "", "", "", ""],
        ["2", "2026-04-16", "입금", "50,000", "5,050,000", "동국대", "", "", "", "", "처리완료"],
      ],
    };
    const got = parseDepositSheet(usedRange);
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({
      row: 2,
      date: "2026-04-15",
      amount: 100000,
      content: "가천대",
      matchedFlag: "",
    });
    expect(got[1]).toEqual({
      row: 3,
      date: "2026-04-16",
      amount: 50000,
      content: "동국대",
      matchedFlag: "처리완료",
    });
  });

  it("출금금액·입금금액 둘 다 있을 때 입금금액을 사용 (출금금액 오매칭 방지)", () => {
    // 실제 입금 시트 컬럼 순서: …출금금액 → 입금금액… (출금금액이 먼저).
    const header = [
      "No", "거래일시", "출금금액", "입금금액", "잔액", "거래내용",
      "상대계좌번호", "상대은행", "CMS코드", "거래구분", "미결제(수표/어음)",
    ];
    const usedRange = {
      values: [
        header,
        [1783, "2026-05-21", 0, 180000, 12669509, "숭실대학교", "", "우리은행", "", "타행이체", ""],
      ],
      text: [
        header,
        ["1783", "2026-05-21", "0", "180,000", "12,669,509", "숭실대학교", "", "우리은행", "", "타행이체", ""],
      ],
    };
    const got = parseDepositSheet(usedRange);
    expect(got).toHaveLength(1);
    expect(got[0].amount).toBe(180000);
    expect(got[0].content).toBe("숭실대학교");
  });

  it("빈 시트 → 빈 배열", () => {
    expect(parseDepositSheet({ values: [], text: [] })).toEqual([]);
  });

  it("헤더만 있는 시트 → 빈 배열", () => {
    expect(
      parseDepositSheet({
        values: [["No", "거래일시", "구분", "입금금액"]],
        text: [["No", "거래일시", "구분", "입금금액"]],
      }),
    ).toEqual([]);
  });
});
