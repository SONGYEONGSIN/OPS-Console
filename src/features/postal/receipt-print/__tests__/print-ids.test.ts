import { describe, it, expect } from "vitest";
import { parsePrintIds, receiptPdfHref, RECEIPT_PDF_PATH } from "../print-ids";
import { RECEIPT_PDF_BATCH } from "../layout";

const id = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const ids = (count: number) =>
  Array.from({ length: count }, (_, i) => id(i + 1));

describe("parsePrintIds", () => {
  it("쉼표로 이은 id 를 받는다", () => {
    expect(parsePrintIds(`${id(1)},${id(2)}`)).toEqual({
      ok: true,
      ids: [id(1), id(2)],
    });
  });

  it("고른 것이 없으면 거절한다", () => {
    for (const raw of [null, "", " , ,"]) {
      expect(parsePrintIds(raw)).toEqual({
        ok: false,
        error: "출력할 영수증을 고르세요",
      });
    }
  });

  it(`${RECEIPT_PDF_BATCH}장을 넘으면 거절한다 — PDF 하나의 상한`, () => {
    expect(parsePrintIds(ids(RECEIPT_PDF_BATCH + 1).join(","))).toEqual({
      ok: false,
      error: `한 번에 ${RECEIPT_PDF_BATCH}장까지 출력합니다`,
    });
  });

  it(`딱 ${RECEIPT_PDF_BATCH}장은 받는다`, () => {
    expect(parsePrintIds(ids(RECEIPT_PDF_BATCH).join(",")).ok).toBe(true);
  });

  it("중복은 한 번만 센다 — 상한도 중복을 뺀 뒤에 본다", () => {
    const r = parsePrintIds(
      [...ids(RECEIPT_PDF_BATCH), id(1), id(2)].join(","),
    );
    expect(r.ok && r.ids).toHaveLength(RECEIPT_PDF_BATCH);
  });

  it("id 형식이 틀리면 거절한다", () => {
    expect(parsePrintIds(`${id(1)},abc`)).toEqual({
      ok: false,
      error: "영수증 id 형식이 올바르지 않습니다",
    });
  });
});

describe("receiptPdfHref", () => {
  it("라우트가 그대로 읽는 주소를 만든다 — 순서도 그대로", () => {
    const href = receiptPdfHref([id(2), id(1)]);
    expect(href.startsWith(`${RECEIPT_PDF_PATH}?ids=`)).toBe(true);
    const back = new URL(href, "http://x").searchParams.get("ids");
    expect(parsePrintIds(back)).toEqual({ ok: true, ids: [id(2), id(1)] });
  });
});
