import { describe, it, expect } from "vitest";
import { parsePettyCashSheet, parseAmount, unreadableBalanceMessage } from "../parse";

/** 실제 시트에서 가져온 모양 — 쉼표·공백이 섞여 있고 숫자만 있는 것도 있다. */
const SHEET = [
  [" 전도금內 ", "", " 잔액 ", "날짜", "내용", "건수", " 금액 ", " 품목 "],
  ["전도금청구", " 500,000 ", " 500,000 ", "", "", "", "", ""],
  ["", "", " 496,080 ", "2026-03-27", "우편물", "1", " 3,920 ", ""],
  ["", "", " 491,800 ", "2026-03-30", "우편물", "1", " 4,280 ", ""],
  ["", "", " 393,820 ", "2026-04-22", "우편물", "1", " 1,600 ", "우편박스"],
  ["전도금청구", " 464,440 ", " 500,000 ", "", "", "", "", ""],
  ["", "", " 151,020 ", "2026-08-18", "우편물", "3", "13290", ""],
];

describe("parseAmount", () => {
  it("쉼표와 공백을 걷어낸다", () => {
    expect(parseAmount(" 496,080 ")).toBe(496080);
  });

  it("숫자만 있어도 읽는다 — 시트에 두 표기가 섞여 있다", () => {
    expect(parseAmount("13290")).toBe(13290);
  });

  it("빈칸은 null", () => {
    expect(parseAmount("")).toBeNull();
    expect(parseAmount("   ")).toBeNull();
  });

  it("숫자가 아니면 null — 합계 문구 등이 섞여도 0으로 세지 않는다", () => {
    expect(parseAmount("합계")).toBeNull();
  });
});

describe("parsePettyCashSheet", () => {
  const p = parsePettyCashSheet(SHEET);

  it("헤더를 건너뛴다", () => {
    expect(p.entries[0].kind).toBe("refill");
  });

  it("청구 행을 읽는다 — 채워서 다시 50만원이 된다", () => {
    const refill = p.entries.find((e) => e.kind === "refill");
    expect(refill).toMatchObject({ kind: "refill", before: 500000, balance: 500000 });
  });

  it("사용 행을 읽는다", () => {
    const use = p.entries.find((e) => e.kind === "spend" && e.date === "2026-03-27");
    expect(use).toMatchObject({
      kind: "spend",
      date: "2026-03-27",
      title: "우편물",
      count: 1,
      amount: 3920,
      balance: 496080,
    });
  });

  it("품목이 있으면 담는다", () => {
    const box = p.entries.find(
      (e) => e.kind === "spend" && e.item === "우편박스",
    );
    expect(box?.kind === "spend" && box.amount).toBe(1600);
  });

  it("쉼표 없는 금액도 읽는다", () => {
    const last = p.entries.find(
      (e) => e.kind === "spend" && e.date === "2026-08-18",
    );
    expect(last?.kind === "spend" && last.amount).toBe(13290);
  });

  it("현재 잔액은 마지막 행의 잔액이다 — 장부라 맨 아래가 지금이다", () => {
    expect(p.balance).toBe(151020);
  });

  it("올해 쓴 총액을 센다", () => {
    // 3,920 + 4,280 + 1,600 + 13,290
    expect(p.totalSpent).toBe(23090);
  });

  it("빈 행은 건너뛴다 — 시트 아래에 빈 줄이 남아 있다", () => {
    const withBlank = parsePettyCashSheet([...SHEET, ["", "", "", "", "", "", "", ""]]);
    expect(withBlank.entries).toHaveLength(p.entries.length);
  });

  it("빈 시트는 빈 결과", () => {
    const empty = parsePettyCashSheet([]);
    expect(empty.entries).toEqual([]);
    expect(empty.balance).toBeNull();
  });
});

/**
 * 날짜 칸이 엑셀 일련번호로 온다.
 *
 * 우편물 확정이 장부에 쓸 때 일련번호로 넣는다(날짜 서식 칸에 문자열을 넣으면
 * 어긋난다). 그런데 읽는 쪽이 되돌리지 않아 화면에 `46255` 가 그대로 찍혔다
 * (2026-08-22 실제). 쓰는 쪽과 읽는 쪽이 같은 규칙을 써야 한다.
 */
describe("날짜 — 엑셀 일련번호", () => {
  const row = (date: string) => [
    ["헤더"],
    ["", "", "", date, "우편물", "13", "54630", "", "437030"],
  ];

  it("일련번호를 날짜로 되돌린다", () => {
    // 46255 = 2026-08-21 (기준 1899-12-30)
    const sheet = parsePettyCashSheet(row("46255"));
    const spend = sheet.entries.find((e) => e.kind === "spend");
    expect(spend && spend.kind === "spend" && spend.date).toBe("2026-08-21");
  });

  it("사람이 적은 문자열 날짜는 그대로 둔다 — 서식이 섞여 있다", () => {
    const sheet = parsePettyCashSheet(row("2026-08-21"));
    const spend = sheet.entries.find((e) => e.kind === "spend");
    expect(spend && spend.kind === "spend" && spend.date).toBe("2026-08-21");
  });

  it("사람이 20260821 처럼 적어도 일련번호로 오해하지 않는다", () => {
    // 일련번호로 읽으면 서기 57000년이 된다. 그럴 바엔 원문을 보여준다.
    const sheet = parsePettyCashSheet(row("20260821"));
    const spend = sheet.entries.find((e) => e.kind === "spend");
    expect(spend && spend.kind === "spend" && spend.date).toBe("20260821");
  });

  it("날짜가 아닌 숫자 문자열까지 바꾸지 않는다 — 빈 칸은 여전히 빈 칸이다", () => {
    const sheet = parsePettyCashSheet(row(""));
    expect(sheet.entries.filter((e) => e.kind === "spend")).toHaveLength(0);
  });
});

/**
 * 현재 잔액을 어느 칸에서 읽었는지 — 못 읽었을 때 어디를 고칠지 말하려면 필요하다.
 *
 * 2026-10-21 사람이 청구 행을 끼워 넣으며 맨 아래 사용 행의 잔액(C) 칸이 비었고,
 * 그 뒤 2주 동안 '현재 잔액을 읽지 못했습니다' 만 반복됐다. 어느 칸인지 말했다면
 * 그날 고쳤다.
 */
describe("balanceCell — 현재 잔액을 읽은 칸", () => {
  it("맨 아래 항목의 시트 행 번호와 C열 원문이다 — 헤더가 1행이다", () => {
    const p = parsePettyCashSheet(SHEET);
    expect(p.balanceCell).toEqual({ row: 7, text: " 151,020 " });
  });

  it("맨 아래 행 잔액이 비면 그 행을 가리킨다", () => {
    const broken = parsePettyCashSheet([
      ...SHEET,
      ["", "", "", "2026-10-21", "우편물", "1", "4350", ""],
    ]);
    expect(broken.balance).toBeNull();
    expect(broken.balanceCell).toEqual({ row: 8, text: "" });
  });

  it("빈 줄은 행 번호를 밀지 않는다 — 빈 줄 아래 항목도 제 행을 가리킨다", () => {
    const p = parsePettyCashSheet([
      SHEET[0],
      ["", "", "", "", "", "", "", ""],
      ["", "", " 496,080 ", "2026-03-27", "우편물", "1", " 3,920 ", ""],
    ]);
    expect(p.balanceCell?.row).toBe(3);
  });

  it("항목이 없으면 칸도 없다", () => {
    expect(parsePettyCashSheet([]).balanceCell).toBeNull();
  });
});

describe("unreadableBalanceMessage — 어디가 비었는지 말한다", () => {
  it("빈 칸이면 시트·행·열을 짚는다", () => {
    expect(unreadableBalanceMessage("2026", { row: 97, text: "" })).toBe(
      "현재 잔액을 읽지 못했습니다 — '2026' 시트 97행 잔액(C) 칸이 비어 있습니다",
    );
  });

  it("공백뿐이어도 빈 칸이다", () => {
    expect(unreadableBalanceMessage("2026", { row: 97, text: "  " })).toMatch(
      /97행 잔액\(C\) 칸이 비어 있습니다$/,
    );
  });

  it("숫자가 아니면 그 값을 보여준다 — 행을 지우면 #REF! 가 된다", () => {
    expect(unreadableBalanceMessage("2026", { row: 97, text: "#REF!" })).toBe(
      "현재 잔액을 읽지 못했습니다 — '2026' 시트 97행 잔액(C) 칸이 숫자가 아닙니다(#REF!)",
    );
  });

  it("항목이 없으면 그렇다고 말한다", () => {
    expect(unreadableBalanceMessage("2026", null)).toBe(
      "현재 잔액을 읽지 못했습니다 — '2026' 시트에 장부 행이 없습니다",
    );
  });
});
