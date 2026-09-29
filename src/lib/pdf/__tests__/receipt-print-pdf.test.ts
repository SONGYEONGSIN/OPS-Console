// @vitest-environment node
//
// 칸에 넣을 JPEG 를 sharp 로 만든다 — node 의 Buffer 가 필요하다.
import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";
import { renderReceiptPrintPdf, type PrintSlot } from "../receipt-print-pdf";

/** 페이지 객체 수 — react-pdf 는 객체 사전을 압축하지 않아 그대로 센다. */
const pageCount = (pdf: Buffer) =>
  (pdf.toString("latin1").match(/\/Type\s*\/Page(?!s)/g) ?? []).length;

async function image(widthPx: number, heightPx: number): Promise<PrintSlot> {
  const jpeg = await sharp({
    create: {
      width: widthPx,
      height: heightPx,
      channels: 3,
      background: "#ffffff",
    },
  })
    .jpeg()
    .toBuffer();
  return { kind: "image", jpeg, widthPx, heightPx };
}

const broken: PrintSlot = {
  kind: "error",
  label: "접수 2026-09-23 15:14",
  reason: "사진을 읽지 못했습니다",
};

describe("renderReceiptPrintPdf", () => {
  it("PDF 를 만든다", { timeout: 20000 }, async () => {
    const pdf = await renderReceiptPrintPdf([await image(465, 1000)]);
    expect(pdf.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("한 페이지에 3장 — 7장이면 3쪽", { timeout: 20000 }, async () => {
    const one = await image(465, 1000);
    const seven = Array.from({ length: 7 }, () => one);
    expect(pageCount(await renderReceiptPrintPdf(seven))).toBe(3);
  });

  it(
    "못 읽은 칸이 섞여도 만든다 — 한 장 때문에 전체가 실패하지 않는다",
    { timeout: 20000 },
    async () => {
      const pdf = await renderReceiptPrintPdf([
        await image(465, 1000),
        broken,
        await image(465, 1000),
      ]);
      expect(pageCount(pdf)).toBe(1);
    },
  );

  /**
   * 넘쳐도 react-pdf 는 새 페이지를 만들지 않는다 — `console.warn` 한 줄만 남기고
   * 페이지 밖으로 나간 아래쪽을 버린다(2026-09-28 실측: 1015mm 칸 → 1쪽 + 경고,
   * 269mm → 경고 0). 그래서 쪽수가 아니라 그 경고로 판정한다.
   */
  it(
    "아주 긴 영수증도 페이지 안에 든다 — 넘치면 아래가 잘린다",
    { timeout: 20000 },
    async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        await renderReceiptPrintPdf([
          await image(465, 8000),
          await image(465, 1000),
        ]);
        expect(warn.mock.calls.flat().join(" ")).not.toMatch(
          /bigger than available page height/,
        );
      } finally {
        warn.mockRestore();
      }
    },
  );
});
