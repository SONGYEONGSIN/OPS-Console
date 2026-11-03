import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import { parsePettyCashSheet, type PettyCashSheet } from "./parse";

/**
 * 전도금 장부 — `08. 비용관리(인증,우편,전도금) > 전도금 > 2026년도 전도금 비용.xlsx`.
 *
 * 시트가 연도별(2026·2025·…)이라 올해 것을 본다. 총괄장과 같은 방식으로 Graph
 * usedRange를 읽는다 — DB에 옮겨 담지 않는다. 원본이 엑셀이고 사람이 거기서도
 * 고치기 때문에, 복제해 두면 어느 쪽이 맞는지 알 수 없게 된다.
 */

/**
 * KST 기준 회계연도. 시트가 4월에 시작해 이듬해 3월에 끝나므로(`2025` 시트가
 * 2026-03-26 까지) 1~3월은 전년도 시트다 — 달력 연도로 고르면 없는 시트를 찾는다.
 */
export function currentSheetName(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "numeric",
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === "year")?.value);
  const month = Number(parts.find((p) => p.type === "month")?.value);
  return String(month >= 4 ? year : year - 1);
}

export const fetchPettyCash = cache(async function fetchPettyCash(
  sheetName: string = currentSheetName(),
): Promise<PettyCashSheet | null> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_PETTY_CASH_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[petty-cash] SHAREPOINT_DRIVE_ID / SHAREPOINT_PETTY_CASH_ITEM_ID 환경 변수 누락",
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[petty-cash] graph token error:", e);
    return null;
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
  const res = await fetch(
    `${base}/worksheets('${encodeURIComponent(sheetName)}')/usedRange(valuesOnly=true)?$select=text`,
    { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
  );
  if (!res.ok) {
    console.error("[petty-cash] usedRange 실패:", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { text?: string[][] };
  if (!json.text) return null;
  return parsePettyCashSheet(json.text);
});
