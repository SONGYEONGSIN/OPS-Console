import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import type { DepositRow } from "./types";

/**
 * Graph usedRange 응답을 DepositRow[]로 변환. 헤더 키워드 매칭으로 컬럼 인덱스 추출.
 * GAS deposit Excel 컬럼: 거래일시(col 1) / 입금금액(col 3) / 거래내용(col 5) / 미결제표시(col 10).
 * 실제 헤더 순서가 다를 수 있으므로 정규식 매칭으로 동적 인덱싱.
 *
 * SharePoint fetch와 분리 — pure function 으로 단위 테스트 가능.
 */
export function parseDepositSheet(data: {
  values?: unknown[][];
  text?: string[][];
}): DepositRow[] {
  const values = data.values ?? [];
  const textValues = data.text ?? values.map((r) => r.map((c) => String(c ?? "")));
  if (values.length < 2) return [];

  const header = values[0].map((h) => String(h ?? "").trim());
  const findCol = (re: RegExp) => header.findIndex((h) => re.test(h));
  const dateCol = findCol(/거래\s*일시|입금\s*일자|거래일자/);
  const amountCol = findCol(/입금\s*금액|금액$/);
  const contentCol = findCol(/거래\s*내용|입금자|입금처/);
  const flagCol = findCol(/미결제|처리|결제\s*표시/);

  if (dateCol < 0 || amountCol < 0 || contentCol < 0) {
    console.warn(
      "[deposit-queries] 필수 헤더 매칭 실패",
      { dateCol, amountCol, contentCol },
    );
    return [];
  }

  const out: DepositRow[] = [];
  for (let i = 1; i < values.length; i++) {
    const row = values[i] ?? [];
    const text = textValues[i] ?? [];

    const dateRaw = String(text[dateCol] ?? row[dateCol] ?? "").trim();
    const amountRaw = row[amountCol];
    const amount =
      typeof amountRaw === "number"
        ? amountRaw
        : Number(String(amountRaw ?? "").replace(/,/g, "")) || 0;
    const content = String(text[contentCol] ?? row[contentCol] ?? "").trim();
    const matchedFlag =
      flagCol >= 0
        ? String(text[flagCol] ?? row[flagCol] ?? "").trim()
        : "";

    if (!dateRaw && !content && amount === 0) continue;

    out.push({
      row: i + 1, // Excel 1-based row number (헤더 1행 + 데이터 i)
      date: dateRaw,
      amount,
      content,
      matchedFlag,
    });
  }
  return out;
}

/**
 * 입금 시트 fetch 실패 시 잡 메시지 — env 미설정과 "설정됐으나 fetch 실패"를 구분.
 * 후자는 파일 이동/이름변경/권한/Graph 응답 문제이므로 Vercel 로그를 봐야 한다.
 */
export function depositFetchFailMessage(itemIdConfigured: boolean): string {
  return itemIdConfigured
    ? "SharePoint 입금내역 시트 fetch 실패 — SHAREPOINT_DEPOSIT_ITEM_ID는 설정됨. 파일 이동/이름변경/권한 또는 Graph 응답 확인 (Vercel 로그)."
    : "SharePoint 입금내역 시트 fetch 실패 — SHAREPOINT_DEPOSIT_ITEM_ID 환경변수 미설정.";
}

/**
 * SharePoint deposit Excel usedRange fetch + parseDepositSheet.
 * - drive_id 재사용: `SHAREPOINT_RECEIVABLES_DRIVE_ID`
 * - item_id 신규: `SHAREPOINT_DEPOSIT_ITEM_ID` (필수)
 * - GAS DEPOSIT_SHEET_NAME = "수수료입금내역조회" — 첫 워크시트 자동 선택
 * 실패/없음 → null.
 */
export async function fetchDepositSheet(): Promise<DepositRow[] | null> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_DEPOSIT_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[deposit] SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_DEPOSIT_ITEM_ID 환경 변수 누락",
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[deposit] graph token error:", e);
    return null;
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
  const headers = { Authorization: `Bearer ${token}` };

  // 첫 워크시트 이름
  const wsRes = await fetch(`${base}/worksheets?$top=1&$select=name`, {
    headers,
    cache: "no-store",
  });
  if (!wsRes.ok) {
    console.error("[deposit] worksheets fail:", wsRes.status, await wsRes.text());
    return null;
  }
  const wsJson = (await wsRes.json()) as { value?: { name: string }[] };
  const name = wsJson.value?.[0]?.name;
  if (!name) return [];

  const enc = encodeURIComponent(name);
  const rangeRes = await fetch(
    `${base}/worksheets('${enc}')/usedRange?$select=values,text`,
    { headers, cache: "no-store" },
  );
  if (!rangeRes.ok) {
    console.error("[deposit] usedRange fail:", rangeRes.status, await rangeRes.text());
    return null;
  }
  const data = (await rangeRes.json()) as {
    values?: unknown[][];
    text?: string[][];
  };
  return parseDepositSheet(data);
}
