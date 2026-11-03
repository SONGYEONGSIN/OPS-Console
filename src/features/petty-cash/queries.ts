import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import { parsePettyCashSheet, type PettyCashSheet } from "./parse";

/**
 * 전도금 장부 — `08. 비용관리(인증,우편,전도금) > 전도금 > 2026년도 전도금 비용.xlsx`.
 *
 * 시트가 연도별(2026·2025·…)이라 지금 쓰는 것을 본다. 총괄장과 같은 방식으로 Graph
 * usedRange를 읽는다 — DB에 옮겨 담지 않는다. 원본이 엑셀이고 사람이 거기서도
 * 고치기 때문에, 복제해 두면 어느 쪽이 맞는지 알 수 없게 된다.
 */

const kstYear = (now: Date): number =>
  Number(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Seoul",
      year: "numeric",
    }).format(now),
  );

/**
 * 있는 연도 시트 중 KST 올해 이하로 가장 큰 것 — 시트는 사람이 3월 하순에 장부를 닫으며
 * 넘기므로(`2025` 가 2026-03-26, `2024` 가 2025-03-19 에 끝났다) 날짜로는 정할 수 없다.
 * 미리 만들어 둔 미래 연도 시트는 고르지 않는다. 연도 시트가 없으면 null.
 */
export function pickSheetName(names: string[], now: Date): string | null {
  const limit = kstYear(now);
  const years = names
    .filter((n) => /^\d{4}$/.test(n))
    .map(Number)
    .filter((y) => y <= limit);
  return years.length > 0 ? String(Math.max(...years)) : null;
}

/** 워크북 주소와 토큰. 설정·인증이 없으면 null(이유는 로그에). */
async function workbookAccess(): Promise<{ base: string; token: string } | null> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_PETTY_CASH_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[petty-cash] SHAREPOINT_DRIVE_ID / SHAREPOINT_PETTY_CASH_ITEM_ID 환경 변수 누락",
    );
    return null;
  }
  try {
    const token = await getGraphToken();
    const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
    return { base, token };
  } catch (e) {
    console.error("[petty-cash] graph token error:", e);
    return null;
  }
}

export type SheetNameResult =
  | { ok: true; name: string }
  | { ok: false; error: string };

/**
 * 지금 쓸 시트 이름을 워크북의 시트 목록에서 정한다. 한 요청에서 한 번만 부르고 그 이름으로
 * 읽고 쓴다 — 읽은 시트와 쓴 시트가 갈리면 잔액이 다른 장부에서 온다.
 */
export async function resolvePettyCashSheetName(
  now: Date = new Date(),
): Promise<SheetNameResult> {
  const access = await workbookAccess();
  if (!access) return { ok: false, error: "전도금 장부 설정이 없습니다" };
  const res = await fetch(`${access.base}/worksheets?$select=name`, {
    headers: { Authorization: `Bearer ${access.token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    console.error("[petty-cash] worksheets 실패:", res.status, await res.text());
    return { ok: false, error: "전도금 장부의 시트 목록을 읽지 못했습니다" };
  }
  const json = (await res.json()) as { value?: { name?: string }[] };
  const names = (json.value ?? []).map((w) => w.name ?? "");
  const name = pickSheetName(names, now);
  if (!name) {
    const year = kstYear(now);
    return {
      ok: false,
      error: `전도금 장부에 ${year}년 이하 연도 이름 시트(예: '${year}')가 없습니다`,
    };
  }
  return { ok: true, name };
}

export const fetchPettyCash = cache(async function fetchPettyCash(
  sheetName: string,
): Promise<PettyCashSheet | null> {
  const access = await workbookAccess();
  if (!access) return null;
  const { base, token } = access;
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
