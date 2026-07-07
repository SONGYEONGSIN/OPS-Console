import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import { selectLatestPaymentSheet } from "./sheet-select";
import { mapPaymentRows } from "./row-map";
import type { PaymentDate } from "./schemas";

/**
 * 비용지급일 Excel 조회 — `NN기비용지급일` 최대 기수 시트를 읽어 PaymentDate[] 반환.
 * - 환경변수: SHAREPOINT_PAYMENT_DRIVE_ID / SHAREPOINT_PAYMENT_ITEM_ID (자체 드라이브)
 * - 실패/누락 → [] (달력은 빈 오버레이로 안전 렌더)
 *
 * 캐시 2겹:
 *  - React cache: 같은 요청 내 중복 호출 dedupe
 *  - 모듈 TTL(10분): 달 이동마다 RSC refetch 시 Graph 왕복(2콜)을 줄인다. 데이터는 드물게 변함.
 */
const TTL_MS = 10 * 60 * 1000;
type CacheEntry = { rows: PaymentDate[]; expiresAt: number };
let moduleCache: CacheEntry | null = null;

export const fetchPaymentDates = cache(
  async function fetchPaymentDates(): Promise<PaymentDate[]> {
    const driveId = process.env.SHAREPOINT_PAYMENT_DRIVE_ID;
    const itemId = process.env.SHAREPOINT_PAYMENT_ITEM_ID;
    if (!driveId || !itemId) {
      console.warn(
        "[payment-dates] SHAREPOINT_PAYMENT_DRIVE_ID / SHAREPOINT_PAYMENT_ITEM_ID 환경 변수 누락",
      );
      return [];
    }

    if (moduleCache && moduleCache.expiresAt > Date.now()) {
      return moduleCache.rows;
    }

    let token: string;
    try {
      token = await getGraphToken();
    } catch (e) {
      console.error("[payment-dates] graph token error:", e);
      return [];
    }

    const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
    const headers = { Authorization: `Bearer ${token}` };

    // 1) 워크시트 목록 → 최대 기수 시트 선택
    const wsRes = await fetch(`${base}/worksheets?$select=name`, {
      headers,
      cache: "no-store",
    });
    if (!wsRes.ok) {
      console.error(
        "[payment-dates] worksheets fail:",
        wsRes.status,
        await wsRes.text(),
      );
      return [];
    }
    const wsJson = (await wsRes.json()) as { value?: { name: string }[] };
    const names = (wsJson.value ?? []).map((w) => w.name);
    const sheetName = selectLatestPaymentSheet(names);
    if (!sheetName) {
      console.warn("[payment-dates] 'NN기비용지급일' 매칭 시트 없음");
      return [];
    }

    // 2) usedRange text → 행 매핑 (한글 접미사 제거는 row-map이 처리)
    const encoded = encodeURIComponent(sheetName);
    const rangeRes = await fetch(
      `${base}/worksheets('${encoded}')/usedRange?$select=text`,
      { headers, cache: "no-store" },
    );
    if (!rangeRes.ok) {
      console.error(
        "[payment-dates] usedRange fail:",
        rangeRes.status,
        await rangeRes.text(),
      );
      return [];
    }
    const data = (await rangeRes.json()) as { text?: string[][] };
    const rows = mapPaymentRows(data.text ?? [], sheetName);
    moduleCache = { rows, expiresAt: Date.now() + TTL_MS };
    return rows;
  },
);

/** 테스트용 TTL 캐시 리셋 */
export function __resetPaymentDatesCache(): void {
  moduleCache = null;
}
