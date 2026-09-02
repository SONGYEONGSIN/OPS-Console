import { describe, it, expect } from "vitest";
import {
  parseDepositSheet,
  depositFetchFailMessage,
} from "../deposit-queries";

describe("depositFetchFailMessage", () => {
  it("item ID 미설정 → 'env 미설정' 안내", () => {
    expect(depositFetchFailMessage(false)).toContain("미설정");
  });
  it("item ID 설정됨 → env 문제로 오해하게 하지 않는다", () => {
    // 문구가 바뀌었다(2026-08-31): 이제 **왜 실패했는지**를 싣는다.
    // 예전에는 "파일 이동/이름변경/권한"만 말해서 멀쩡한 파일을 찾아다니게 했다.
    const msg = depositFetchFailMessage(true, "Graph 503 — 잠시 후 다시");
    expect(msg).toContain("503");
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

/**
 * `text` 없이 `values` 만으로도 읽힌다.
 *
 * `usedRange?$select=values,text` 가 401KB·4.5초였고 Graph 가
 * `MaxRequestDurationExceeded` 로 끊었다(2026-09-02 09:01·10:00). `valuesOnly` 는
 * 186KB·3.0초다 — **절반 이상 가볍다.**
 *
 * 실측해 보니 거래일시가 이미 `2025-12-01 11:58:00` 문자열로 온다. `text` 는
 * 같은 값을 한 번 더 실어 보내고 있었다.
 */
describe("parseDepositSheet — values 만으로", () => {
  const values = [
    ["No", "거래일시", "출금금액", "입금금액", "잔액", "거래내용"],
    [1, "2025-12-01 11:58:00", 0, 250000, 259343723, "특정금전신탁이체"],
    [2, "2025-12-02 09:10:00", 0, 330000, 259673723, "홍길동"],
  ];

  it("text 가 없어도 날짜를 읽는다", () => {
    const rows = parseDepositSheet({ values });
    expect(rows[0].date).toBe("2025-12-01 11:58:00");
  });

  it("금액과 내용도 그대로", () => {
    const rows = parseDepositSheet({ values });
    expect(rows[0].amount).toBe(250000);
    expect(rows[1].content).toBe("홍길동");
  });

  it("text 가 함께 와도 같은 결과 — 옛 응답과 호환된다", () => {
    const text = values.map((r) => r.map((c) => String(c ?? "")));
    expect(parseDepositSheet({ values, text })).toEqual(parseDepositSheet({ values }));
  });
});
