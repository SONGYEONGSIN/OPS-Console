import { describe, it, expect } from "vitest";
import {
  sortBasis,
  sortForPrint,
  planBatches,
  toPages,
  fitToSlot,
  printFileName,
  RECEIPT_PDF_BATCH,
  PAGE_MM,
  SLOT_MAX_HEIGHT_MM,
} from "../layout";

const k = (
  id: string,
  acceptedAt: string | null,
  createdAt = "2026-09-01T00:00:00Z",
) => ({
  id,
  acceptedAt,
  createdAt,
});

describe("sortBasis — 정렬 기준", () => {
  it("판독한 접수일시를 쓴다", () => {
    expect(sortBasis(k("a", "2026-09-23 15:14"))).toEqual({
      key: "2026-09-23 15:14",
      basis: "accepted",
    });
  });

  it("초가 붙어 와도 분까지만 본다", () => {
    expect(sortBasis(k("a", "2026-09-23 15:14:59")).key).toBe(
      "2026-09-23 15:14",
    );
  });

  it("날짜만 있으면 그날 0시로 센다", () => {
    expect(sortBasis(k("a", "2026-09-23")).key).toBe("2026-09-23 00:00");
  });

  it("판독 전이면 올린 시각을 한국 시각으로 쓴다 — UTC 로 두면 자정 전후가 하루 앞선다", () => {
    expect(sortBasis(k("a", null, "2026-09-22T15:30:00Z"))).toEqual({
      key: "2026-09-23 00:30",
      basis: "uploaded",
    });
  });

  it("모르는 모양의 접수일시는 올린 시각으로 센다", () => {
    expect(sortBasis(k("a", "9월 23일", "2026-09-22T15:30:00Z"))).toEqual({
      key: "2026-09-23 00:30",
      basis: "uploaded",
    });
  });
});

describe("sortForPrint — 전표에 붙는 순서", () => {
  it("접수일시 오름차순", () => {
    const out = sortForPrint([
      k("b", "2026-09-23 15:14"),
      k("a", "2026-09-17 10:00"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b"]);
  });

  it("판독 전 영수증은 올린 시각(한국)으로 사이에 낀다", () => {
    const out = sortForPrint([
      k("c", "2026-09-23 01:00"),
      k("b", null, "2026-09-22T15:30:00Z"), // 한국 09-23 00:30
      k("a", "2026-09-23 00:10"),
    ]);
    expect(out.map((x) => x.id)).toEqual(["a", "b", "c"]);
  });

  it("받은 배열을 바꾸지 않는다", () => {
    const input = [k("b", "2026-09-23 15:14"), k("a", "2026-09-17 10:00")];
    sortForPrint(input);
    expect(input.map((x) => x.id)).toEqual(["b", "a"]);
  });
});

describe("planBatches — PDF 묶음", () => {
  const minute = (i: number) => {
    const t = 600 + i; // 10:00 부터 1분씩
    return `2026-09-23 ${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  };
  const many = (n: number) =>
    Array.from({ length: n }, (_, i) =>
      k(`r${String(i + 1).padStart(3, "0")}`, minute(i)),
    );

  it(`${RECEIPT_PDF_BATCH}장 이하면 하나`, () => {
    expect(planBatches(many(RECEIPT_PDF_BATCH))).toHaveLength(1);
  });

  it(`넘으면 ${RECEIPT_PDF_BATCH}장씩 — 몇 번째 장인지 함께`, () => {
    const B = RECEIPT_PDF_BATCH;
    const out = planBatches(many(B + 15));
    expect(out.map((b) => [b.from, b.to, b.ids.length])).toEqual([
      [1, B, B],
      [B + 1, B + 15, 15],
    ]);
  });

  it("경계는 정렬한 뒤에 긋는다 — 받은 순서가 거꾸로여도 앞 묶음이 이른 것", () => {
    const B = RECEIPT_PDF_BATCH;
    const out = planBatches(many(B + 15).reverse());
    const last = out[1].ids;
    expect(out[0].ids[0]).toBe("r001");
    expect(last[last.length - 1]).toBe(`r${String(B + 15).padStart(3, "0")}`);
  });
});

describe("toPages — 한 페이지 한 줄 3칸", () => {
  it("7장이면 3·3·1", () => {
    expect(toPages([1, 2, 3, 4, 5, 6, 7]).map((p) => p.length)).toEqual([
      3, 3, 1,
    ]);
  });
});

describe("fitToSlot — 칸에 넣을 크기(mm)", () => {
  it("칸 폭에 맞추고 비율을 지킨다", () => {
    const f = fitToSlot(465, 1033);
    expect(f.widthMm).toBe(PAGE_MM.slotWidth);
    expect(f.heightMm).toBeCloseTo((1033 / 465) * PAGE_MM.slotWidth);
  });

  it("페이지보다 긴 영수증은 높이에 맞춰 줄인다", () => {
    const f = fitToSlot(465, 5000);
    expect(f.heightMm).toBe(SLOT_MAX_HEIGHT_MM);
    expect(f.widthMm / f.heightMm).toBeCloseTo(465 / 5000);
  });
});

describe("printFileName", () => {
  it("첫 날과 끝 날을 적는다", () => {
    expect(
      printFileName([k("a", "2026-09-23 15:14"), k("b", "2026-09-17 10:00")]),
    ).toBe("우편영수증_2026-09-17_2026-09-23.pdf");
  });

  it("하루뿐이면 날짜 하나", () => {
    expect(
      printFileName([k("a", "2026-09-23 15:14"), k("b", "2026-09-23 09:00")]),
    ).toBe("우편영수증_2026-09-23.pdf");
  });

  it("판독 전 영수증은 올린 날(한국)로 센다", () => {
    expect(printFileName([k("a", null, "2026-09-22T15:30:00Z")])).toBe(
      "우편영수증_2026-09-23.pdf",
    );
  });
});
