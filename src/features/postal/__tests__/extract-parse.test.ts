import { describe, it, expect } from "vitest";
import { parseExtraction, assignDaySeq } from "../extract-parse";

const GOOD = {
  is_receipt: true,
  receipt_no: "11127268",
  accepted_at: "2026-08-18 16:24",
  total_fee: 13290,
  item_count: 3,
  items: [
    { tracking_no: "11263-1102-7080", fee: 4590, postal_code: "55338", recipient_org: "우석대", recipient_name: "강정화" },
    { tracking_no: "11263-1102-7081", fee: 4230, postal_code: "24210", recipient_org: "한림성심대", recipient_name: "김한솔" },
    { tracking_no: "11263-1102-7082", fee: 4470, postal_code: "51140", recipient_org: "창원대", recipient_name: "김좌경" },
  ],
};

describe("parseExtraction", () => {
  it("정상 추출을 받아들인다", () => {
    const r = parseExtraction(JSON.stringify(GOOD));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.items).toHaveLength(3);
  });

  it("코드펜스로 감싸 와도 읽는다 — 모델이 종종 그렇게 답한다", () => {
    const r = parseExtraction("```json\n" + JSON.stringify(GOOD) + "\n```");
    expect(r.ok).toBe(true);
  });

  /**
   * 실제로 겪었다 — 모델이 "I'll open the receipt image first." 를 먼저 말하고
   * JSON을 냈다. 앞말을 그대로 두면 JSON.parse 가 깨진다.
   */
  it("앞뒤에 말이 섞여 와도 JSON 덩어리를 찾아 읽는다", () => {
    const r = parseExtraction(
      "I'll open the receipt image first.\n\n" + JSON.stringify(GOOD) + "\n\n확인했습니다.",
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.receipt_no).toBe("11127268");
  });

  it("JSON 비슷한 것도 없으면 실패", () => {
    expect(parseExtraction("영수증을 열어보겠습니다. 그런데 흐려서 못 읽겠습니다.").ok).toBe(false);
  });

  it("영수증이 아니라고 하면 그대로 알린다 — 화면 캡처를 올린 적이 있다", () => {
    const r = parseExtraction(JSON.stringify({ is_receipt: false }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/영수증/);
  });

  it("JSON이 아니면 실패", () => {
    expect(parseExtraction("읽을 수 없습니다").ok).toBe(false);
  });

  it("등기번호가 없는 행은 거부한다 — 그게 없으면 엑셀에 못 쓴다", () => {
    const bad = { ...GOOD, items: [{ ...GOOD.items[0], tracking_no: "" }] };
    expect(parseExtraction(JSON.stringify(bad)).ok).toBe(false);
  });

  /**
   * 개별 요금 합이 총요금과 다르면 어딘가 잘못 읽은 것이다.
   * 사람이 보기 전에 기계가 먼저 걸러낸다.
   */
  it("합계가 안 맞으면 경고를 단다 — 막지는 않는다(사람이 고칠 수 있다)", () => {
    const bad = { ...GOOD, total_fee: 99999 };
    const r = parseExtraction(JSON.stringify(bad));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.join()).toMatch(/합계/);
  });

  it("합계가 맞으면 경고가 없다", () => {
    const r = parseExtraction(JSON.stringify(GOOD));
    if (r.ok) expect(r.warnings).toEqual([]);
  });

  it("건수가 안 맞아도 경고", () => {
    const r = parseExtraction(JSON.stringify({ ...GOOD, item_count: 5 }));
    if (r.ok) expect(r.warnings.join()).toMatch(/건수/);
  });

  /** 영수증에는 카드 승인번호·가맹점번호가 찍혀 있다. 업무에 쓸 일이 없다. */
  it("카드 관련 값이 섞여 오면 버린다 — 칸이 없어도 실어 보낼 수 있다", () => {
    const withCard = {
      ...GOOD,
      card_no: "5327-5011-****-945*",
      approval_no: "28008612",
      merchant_no: "00916075815",
    };
    const r = parseExtraction(JSON.stringify(withCard));
    expect(r.ok).toBe(true);
    if (r.ok) {
      const dumped = JSON.stringify(r.data);
      expect(dumped).not.toContain("28008612");
      expect(dumped).not.toContain("5327");
      expect(dumped).not.toContain("00916075815");
    }
  });
});

describe("assignDaySeq", () => {
  it("등기번호 순으로 1부터 매기되, 돌려주는 순서는 입력 그대로다", () => {
    // 입력이 7082·7080·7081 이면 번호는 7080=1, 7081=2, 7082=3.
    // 결과 배열은 입력 자리에 맞춰 [3, 1, 2] — 호출부가 행 순서를 그대로 쓴다.
    const seq = assignDaySeq(
      [{ tracking_no: "11263-1102-7082" }, { tracking_no: "11263-1102-7080" }, { tracking_no: "11263-1102-7081" }],
      0,
    );
    expect(seq).toEqual([3, 1, 2]);
  });

  it("같은 날 앞선 영수증이 있으면 이어서 붙인다 — 엑셀 순번은 그날 단위다", () => {
    const seq = assignDaySeq([{ tracking_no: "A" }, { tracking_no: "B" }], 5);
    expect(seq).toEqual([6, 7]);
  });

  it("빈 목록은 빈 배열", () => {
    expect(assignDaySeq([], 0)).toEqual([]);
  });
});
