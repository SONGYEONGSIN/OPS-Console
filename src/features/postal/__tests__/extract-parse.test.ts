import { describe, it, expect } from "vitest";
import {
  parseExtraction,
  assignDaySeq,
  readRegions,
  hasHighlightRegions,
} from "../extract-parse";

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

/**
 * 사진 속 위치 — 영수증 출력이 종이를 잘라내고 접수일자·총요금에 형광펜을 입힌다.
 *
 * 좌표는 사진 왼쪽 위가 0, 오른쪽 아래가 1 인 비율 `[x0, y0, x1, y1]`.
 * **이상한 상자는 그 상자만 버린다** — 형광펜보다 금액·등기번호가 중요하다.
 */
describe("parseExtraction — 위치(regions)", () => {
  const REGIONS = {
    receipt: [0.18, 0, 0.78, 1],
    accepted_at: [0.37, 0.12, 0.56, 0.14],
    total_fee: [0.53, 0.59, 0.72, 0.61],
  };
  const parse = (regions: unknown) =>
    parseExtraction(JSON.stringify({ ...GOOD, regions }));

  it("세 상자를 그대로 싣는다", () => {
    const r = parse(REGIONS);
    expect(r.ok && r.data.regions).toEqual(REGIONS);
  });

  it("위치가 없으면 null — 위치를 묻기 전 판독과 같은 모양이다", () => {
    const r = parseExtraction(JSON.stringify(GOOD));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.regions).toBeNull();
  });

  it("범위를 벗어난 상자는 그 상자만 버린다 — 판독은 산다", () => {
    const r = parse({ ...REGIONS, receipt: [0.18, 0, 1.2, 1] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.regions?.receipt).toBeNull();
      expect(r.data.regions?.accepted_at).toEqual(REGIONS.accepted_at);
      expect(r.data.items).toHaveLength(3);
    }
  });

  it("픽셀로 온 좌표도 범위 밖이라 버린다", () => {
    const r = parse({ ...REGIONS, total_fee: [1602, 2380, 2177, 2460] });
    expect(r.ok && r.data.regions?.total_fee).toBeNull();
  });

  it("뒤집힌 상자는 버린다", () => {
    const r = parse({ ...REGIONS, accepted_at: [0.56, 0.12, 0.37, 0.14] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("위아래가 뒤집힌 상자도 버린다", () => {
    const r = parse({ ...REGIONS, accepted_at: [0.37, 0.14, 0.56, 0.12] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("폭이 0인 상자는 버린다 — 칠할 곳이 없다", () => {
    const r = parse({ ...REGIONS, accepted_at: [0.37, 0.12, 0.37, 0.14] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("음수 좌표는 버린다", () => {
    const r = parse({ ...REGIONS, receipt: [-0.02, 0, 0.78, 1] });
    expect(r.ok && r.data.regions?.receipt).toBeNull();
  });

  it("숫자가 아닌 좌표는 버린다", () => {
    const r = parse({ ...REGIONS, accepted_at: ["0.37", "0.12", "0.56", "0.14"] });
    expect(r.ok && r.data.regions?.accepted_at).toBeNull();
  });

  it("상자 하나만 오면 나머지는 null", () => {
    const r = parse({ receipt: REGIONS.receipt });
    expect(r.ok && r.data.regions).toEqual({
      receipt: REGIONS.receipt,
      accepted_at: null,
      total_fee: null,
    });
  });

  it("위치가 통째로 이상해도 판독은 산다 — 금액이 그대로다", () => {
    const r = parse("잘 모르겠음");
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.regions).toBeNull();
    expect(r.ok && r.data.total_fee).toBe(GOOD.total_fee);
  });
});

/** 저장된 판독(jsonb)에서 위치를 꺼낸다 — 영수증 출력과 목록이 쓴다. */
describe("readRegions", () => {
  const REGIONS = {
    receipt: [0.18, 0, 0.78, 1],
    accepted_at: [0.37, 0.12, 0.56, 0.14],
    total_fee: [0.53, 0.59, 0.72, 0.61],
  };

  it("저장된 위치를 돌려준다", () => {
    expect(readRegions({ items: [], regions: REGIONS })).toEqual(REGIONS);
  });

  it("위치를 묻기 전 판독·판독 전은 null", () => {
    expect(readRegions({ items: [] })).toBeNull();
    expect(readRegions(null)).toBeNull();
  });

  it("저장된 값도 다시 거른다 — 이상한 상자는 그 상자만 null", () => {
    const r = readRegions({ regions: { ...REGIONS, receipt: [0.9, 0, 0.1, 1] } });
    expect(r?.receipt).toBeNull();
    expect(r?.total_fee).toEqual(REGIONS.total_fee);
  });

  it("누운 판독의 위치는 쓰지 않는다 — 누운 픽셀 기준이라 세운 사진에 안 맞는다", () => {
    for (const top of ["right", "bottom", "left"]) {
      expect(readRegions({ regions: REGIONS, receipt_top: top })).toBeNull();
    }
  });

  it("바로 선 판독·방향을 묻기 전 판독·이상한 방향은 위치를 그대로 쓴다", () => {
    expect(readRegions({ regions: REGIONS, receipt_top: "top" })).toEqual(REGIONS);
    expect(readRegions({ regions: REGIONS })).toEqual(REGIONS);
    expect(readRegions({ regions: REGIONS, receipt_top: "up" })).toEqual(REGIONS);
  });
});

/**
 * 영수증 맨 위가 사진의 어느 쪽인가 — 픽셀째 누운 사진을 서버가 세운다(sideways-photo.ts).
 * 없거나 이상하면 null = 바로 선 것으로 본다.
 */
describe("parseExtraction — 방향(receipt_top)", () => {
  const parse = (receipt_top: unknown) =>
    parseExtraction(JSON.stringify({ ...GOOD, receipt_top }));

  it("넷 중 하나면 그대로 싣는다", () => {
    for (const top of ["top", "right", "bottom", "left"]) {
      const r = parse(top);
      expect(r.ok && r.data.receipt_top).toBe(top);
    }
  });

  it("없으면 null — 방향을 묻기 전 판독과 같은 모양이다", () => {
    const r = parseExtraction(JSON.stringify(GOOD));
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.receipt_top).toBeNull();
  });

  it("이상한 값은 null — 판독은 산다", () => {
    for (const bad of ["up", "RIGHT", 90, true]) {
      const r = parse(bad);
      expect(r.ok).toBe(true);
      expect(r.ok && r.data.receipt_top).toBeNull();
    }
  });
});

/** 형광펜 두 자리를 다 찾았나 — 목록의 출력 안내("N장 중 M장은…")가 센다. */
describe("hasHighlightRegions", () => {
  const box: [number, number, number, number] = [0.1, 0.1, 0.2, 0.2];

  it("접수일자·총요금이 다 있으면 참 — 종이 상자는 안 본다", () => {
    expect(hasHighlightRegions({ receipt: null, accepted_at: box, total_fee: box })).toBe(true);
  });

  it("하나라도 없으면 거짓", () => {
    expect(hasHighlightRegions({ receipt: box, accepted_at: box, total_fee: null })).toBe(false);
    expect(hasHighlightRegions(null)).toBe(false);
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

/**
 * 개별 요금 합과 승인금액이 다를 때는 **승인금액**을 쓴다.
 *
 * 실제로 어긋나는 영수증이 있다(2026-08-21). 장부에 적을 것은 **실제로 결제된 돈**
 * 이므로 승인금액이 기준이다. 개별 요금은 등기 한 건씩의 값이라 합이 다를 수 있다.
 *
 * 어긋난 사실 자체는 경고로 남긴다 — 조용히 고르면 왜 다른지 아무도 안 본다.
 */
describe("parseExtract — 승인금액", () => {
  const base = {
    is_receipt: true,
    accepted_at: "2026-08-21 16:24",
    receipt_no: "11127268",
    item_count: 2,
    items: [
      { tracking_no: "11263-1102-7080", fee: 4590, postal_code: "55338", recipient: "우석대 강정화" },
      { tracking_no: "11263-1102-7081", fee: 4230, postal_code: "24210", recipient: "한림성심대 김한솔" },
    ],
  };

  it("승인금액이 있으면 그걸 총액으로 쓴다", () => {
    const r = parseExtraction(
      JSON.stringify({ ...base, total_fee: 8820, approved_amount: 8900 }),
    );
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.total_fee).toBe(8900);
  });

  it("어긋나면 경고로 남긴다 — 조용히 고르지 않는다", () => {
    const r = parseExtraction(
      JSON.stringify({ ...base, total_fee: 8820, approved_amount: 8900 }),
    );
    expect(r.ok && r.warnings.join(" ")).toMatch(/승인금액/);
  });

  it("승인금액이 없으면 총요금을 쓴다 — 예전과 같다", () => {
    const r = parseExtraction(JSON.stringify({ ...base, total_fee: 8820 }));
    expect(r.ok && r.data.total_fee).toBe(8820);
  });

  it("같으면 경고를 만들지 않는다", () => {
    const r = parseExtraction(
      JSON.stringify({ ...base, total_fee: 8820, approved_amount: 8820 }),
    );
    expect(r.ok && r.warnings.join(" ")).not.toMatch(/승인금액/);
  });
});
