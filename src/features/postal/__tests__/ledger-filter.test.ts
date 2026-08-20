import { describe, it, expect } from "vitest";
import {
  ledgerYears,
  filterLedger,
  groupByMonth,
  LEDGER_PAGE_SIZE,
} from "../ledger-filter";
import type { LedgerLine } from "../ledger";

const line = (over: Partial<LedgerLine> = {}): LedgerLine => ({
  seq: 1,
  sentOn: "2026-08-18",
  recipientOrg: "우석대학교",
  recipientName: "강정화",
  assignee: "김지현",
  confirmedBy: "박수정",
  trackingNo: "11263-1102-7080",
  note: "",
  receiptId: null,
  ...over,
});

/**
 * 대장 목록 다루기.
 *
 * 266행이 일자별로 갈려 화면이 끝없이 길어졌다. 월 단위로 묶고 페이지로 끊는다.
 * 연도는 시트가 곧 연도라, **시트 목록에서 뽑는다** — 코드에 박으면 내년에 안 는다.
 */
describe("ledgerYears", () => {
  it("시트 이름에서 연도를 뽑아 최신순으로", () => {
    expect(
      ledgerYears([
        "2026년도 우편물발송(04월~)",
        "2025 우편물 담당자",
        "2024년도 우편물발송(04월~)",
        "2025년도 우편물발송(04월~)",
      ]),
    ).toEqual([2026, 2025, 2024]);
  });

  it("발송 시트가 아닌 것은 세지 않는다 — '2025 우편물 담당자'는 대장이 아니다", () => {
    expect(ledgerYears(["2025 우편물 담당자"])).toEqual([]);
  });
});

describe("filterLedger", () => {
  const rows = [
    line(),
    line({ recipientOrg: "한림성심대학교", recipientName: "김한솔", trackingNo: "11263-1102-7081" }),
    line({
      recipientOrg: "국립창원대학교",
      recipientName: "김좌경",
      assignee: "기자의",
      trackingNo: "11263-1102-7082",
    }),
  ];

  it("빈 검색어면 전부", () => {
    expect(filterLedger(rows, "")).toHaveLength(3);
  });

  it("수신처·수신자·담당자·등기번호를 함께 본다", () => {
    expect(filterLedger(rows, "한림")).toHaveLength(1);
    expect(filterLedger(rows, "강정화")).toHaveLength(1);
    expect(filterLedger(rows, "기자의")).toHaveLength(1);
    expect(filterLedger(rows, "7082")).toHaveLength(1);
  });

  it("등기번호는 하이픈을 빼고도 찾힌다 — 사람은 붙여 친다", () => {
    expect(filterLedger(rows, "1126311027080")).toHaveLength(1);
  });

  it("대소문자·공백을 흘려 넘긴다", () => {
    expect(filterLedger(rows, "  한림  ")).toHaveLength(1);
  });
});

describe("groupByMonth", () => {
  it("월 단위로 묶고 최신 달이 위로", () => {
    const g = groupByMonth([
      line({ sentOn: "2026-08-18" }),
      line({ sentOn: "2026-08-14" }),
      line({ sentOn: "2026-07-30" }),
    ]);
    expect(g.map(([m]) => m)).toEqual(["2026-08", "2026-07"]);
    expect(g[0][1]).toHaveLength(2);
  });

  it("달 안에서는 최근 날짜가 위 — 대장은 아래로 쌓이지만 화면은 최근이 먼저다", () => {
    const g = groupByMonth([
      line({ sentOn: "2026-08-14", trackingNo: "a" }),
      line({ sentOn: "2026-08-18", trackingNo: "b" }),
    ]);
    expect(g[0][1][0].trackingNo).toBe("b");
  });

  it("한 페이지 크기가 정해져 있다", () => {
    expect(LEDGER_PAGE_SIZE).toBeGreaterThan(0);
  });
});
