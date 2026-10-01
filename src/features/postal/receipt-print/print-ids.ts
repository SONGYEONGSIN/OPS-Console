import { z } from "zod";
import { RECEIPT_PDF_BATCH } from "./layout";

/**
 * 영수증 출력 주소 — 화면이 만들고 라우트가 읽는다.
 *
 * 둘을 한 파일에 둔다. 한쪽만 바뀌면 버튼은 멀쩡해 보이는데 눌러도 400 이 난다.
 */
export const RECEIPT_PDF_PATH = "/api/postal/receipts/pdf";

export function receiptPdfHref(ids: readonly string[]): string {
  return `${RECEIPT_PDF_PATH}?ids=${ids.join(",")}`;
}

export type ParsedIds =
  { ok: true; ids: string[] } | { ok: false; error: string };

const uuid = z.uuid();

/** `ids=<uuid>,<uuid>,…` — 중복을 뺀 뒤 1~RECEIPT_PDF_BATCH 개. */
export function parsePrintIds(raw: string | null): ParsedIds {
  const ids = [
    ...new Set(
      (raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.length === 0) return { ok: false, error: "출력할 영수증을 고르세요" };
  if (ids.length > RECEIPT_PDF_BATCH) {
    return {
      ok: false,
      error: `한 번에 ${RECEIPT_PDF_BATCH}장까지 출력합니다`,
    };
  }
  if (!ids.every((id) => uuid.safeParse(id).success)) {
    return { ok: false, error: "영수증 id 형식이 올바르지 않습니다" };
  }
  return { ok: true, ids };
}
