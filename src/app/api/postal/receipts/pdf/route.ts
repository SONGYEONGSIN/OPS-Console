import { NextResponse } from "next/server";
import { getCurrentOperator } from "@/features/auth/queries";
import { canViewMenu } from "@/features/auth/permission";
import { parsePrintIds } from "@/features/postal/receipt-print/print-ids";
import {
  printFileName,
  sortBasis,
  sortForPrint,
} from "@/features/postal/receipt-print/layout";
import {
  downloadReceipt,
  loadPrintSources,
  type PrintSource,
} from "@/features/postal/receipt-print/sources";
import { renderReceiptImage } from "@/features/postal/receipt-print/render-image";
import {
  renderReceiptPrintPdf,
  type PrintSlot,
} from "@/lib/pdf/receipt-print-pdf";

/**
 * 우편 영수증 A4 출력 — `GET /api/postal/receipts/pdf?ids=<uuid>,…`
 *
 * 고른 영수증(최대 30장)을 접수일시 순으로 잘라 형광펜을 입혀 한 페이지 3장씩 놓는다.
 * 내부 전표 증빙용이다. 설계: docs/superpowers/specs/2026-09-28-postal-receipt-print-design.md
 */

/** 사진 30장을 받아 처리하는 시간. 플랜마다 다른 기본 한도에 기대지 않는다. */
export const maxDuration = 60;

export async function GET(request: Request) {
  const me = await getCurrentOperator();
  if (!me) {
    return NextResponse.json(
      { ok: false, error: "로그인이 필요합니다" },
      { status: 401 },
    );
  }
  // 페이지(`requireMenu("postal")`)와 같은 판정 — 두 벌이면 한쪽만 바뀐다.
  if (!canViewMenu("postal", me)) {
    return NextResponse.json(
      { ok: false, error: "우편물 메뉴 권한이 없습니다" },
      { status: 403 },
    );
  }

  const parsed = parsePrintIds(new URL(request.url).searchParams.get("ids"));
  if (!parsed.ok) {
    return NextResponse.json(
      { ok: false, error: parsed.error },
      { status: 400 },
    );
  }

  const sources = sortForPrint(await loadPrintSources(parsed.ids));
  if (sources.length === 0) {
    return NextResponse.json(
      { ok: false, error: "영수증을 찾을 수 없습니다" },
      { status: 404 },
    );
  }

  // 한 장씩 — 3024×4032 사진을 한꺼번에 풀면 메모리가 장수만큼 커진다.
  const slots: PrintSlot[] = [];
  for (const source of sources) {
    slots.push(await toSlot(source));
  }
  const pdf = await renderReceiptPrintPdf(slots);

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(printFileName(sources))}`,
      // 수취인 실명·카드 결제 정보가 찍힌 영수증이다 — 버킷을 비공개로 둔 이유가 캐시로 새지 않게.
      "cache-control": "private, no-store",
    },
  });
}

/** 한 칸. 못 받거나 못 읽으면 사유를 적는다 — 한 장 때문에 전체가 실패하지 않는다. */
async function toSlot(source: PrintSource): Promise<PrintSlot> {
  const { key, basis } = sortBasis(source);
  const label = `${basis === "accepted" ? "접수" : "올림"} ${key}`;
  const input = await downloadReceipt(source.storagePath);
  if (!input) return { kind: "error", label, reason: "사진을 받지 못했습니다" };
  try {
    return {
      kind: "image",
      ...(await renderReceiptImage(input, source.regions)),
    };
  } catch (err) {
    console.error("[postal-pdf] 영수증 사진 처리 실패", source.id, err);
    return {
      kind: "error",
      label,
      reason: /\.hei[cf]$/i.test(source.storagePath)
        ? "HEIC 사진은 넣을 수 없습니다 — JPG 로 다시 올려 주세요"
        : "사진을 읽지 못했습니다",
    };
  }
}
