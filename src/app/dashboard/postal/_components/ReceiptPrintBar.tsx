"use client";

import { HeaderActionButton } from "@/components/common/HeaderActionButton";
import {
  planBatches,
  RECEIPT_PDF_BATCH,
  type PrintOrderKey,
} from "@/features/postal/receipt-print/layout";
import { receiptPdfHref } from "@/features/postal/receipt-print/print-ids";

/**
 * 영수증 출력 버튼 줄 — 목록 제목 오른쪽.
 *
 * 30장까지는 버튼 하나, 넘으면 접수일시 순으로 30장씩 나눈 버튼을 놓는다(PDF 하나에
 * 30장이 서버 상한이다). 형광펜 자리를 다 못 찾은 장수는 **여기에만** 적는다 —
 * PDF 는 전표에 붙는 종이라 안내를 찍지 않는다.
 */
export type PrintPick = PrintOrderKey & {
  /** 형광펜 두 자리(접수일자·총요금)를 다 찾았나 */
  hasRegions: boolean;
};

const batchLabel = (from: number, to: number) =>
  from === to ? `${from}장 PDF` : `${from}~${to}장 PDF`;

export function ReceiptPrintBar({ picks }: { picks: PrintPick[] }) {
  if (picks.length === 0) {
    return (
      <HeaderActionButton disabled title="표에서 출력할 영수증을 체크하세요">
        영수증 출력 (0)
      </HeaderActionButton>
    );
  }

  const batches = planBatches(picks);
  const missing = picks.filter((p) => !p.hasRegions).length;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {missing > 0 && (
        <span className="text-xs text-muted">
          {`${picks.length}장 중 ${missing}장은 형광펜이 빠진 곳이 있습니다`}
        </span>
      )}
      {batches.length === 1 ? (
        <HeaderActionButton href={receiptPdfHref(batches[0].ids)}>
          {`영수증 출력 (${picks.length})`}
        </HeaderActionButton>
      ) : (
        <>
          <span className="text-xs text-muted">
            {`${picks.length}장 — ${RECEIPT_PDF_BATCH}장씩 나눠 받습니다`}
          </span>
          {batches.map((b) => (
            <HeaderActionButton key={b.from} href={receiptPdfHref(b.ids)}>
              {batchLabel(b.from, b.to)}
            </HeaderActionButton>
          ))}
        </>
      )}
    </div>
  );
}
