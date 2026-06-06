import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";
import type { SmileEdiRow } from "./types";

export type SmileEdiSheet = {
  worksheetName: string;
  rows: SmileEdiRow[];
  /** '이메일오류' 컬럼의 0-based 원본 인덱스 (PATCH cell address 계산용). 없으면 -1 */
  emailErrorColIdx: number;
  fetchedAt: string;
};

// 역발행 세금계산서 시트 헤더(행3) → SmileEdiRow 필드 매핑
const COLUMN_MAP: Record<keyof Omit<SmileEdiRow, "excelRow">, string> = {
  writeDate: "작성일자",
  item: "품목",
  supplyAmount: "공급가액",
  taxAmount: "세액",
  companyName: "거래처명",
  receiverDept: "담당부서-공급받는자",
  supplierManager: "담당자명-공급자",
  approvalNumber: "승인번호",
  emailError: "이메일오류",
};

function findCol(headers: string[], name: string): number {
  return headers.findIndex((h) => h.trim() === name);
}

/**
 * 순수 파서 — 헤더 + display 텍스트 행 → SmileEdiRow[]. (Graph I/O 분리, 단위테스트 대상)
 * @param dataStartRowNumber 첫 데이터 행의 1-based 시트 행 번호 (header row3 → 4)
 */
export function parseSmileEdiRows(
  headers: string[],
  textRows: string[][],
  dataStartRowNumber: number,
): { rows: SmileEdiRow[]; emailErrorColIdx: number } {
  const idx = {} as Record<keyof Omit<SmileEdiRow, "excelRow">, number>;
  (Object.keys(COLUMN_MAP) as (keyof typeof COLUMN_MAP)[]).forEach((k) => {
    idx[k] = findCol(headers, COLUMN_MAP[k]);
  });

  const cell = (row: string[], i: number) =>
    i >= 0 ? String(row[i] ?? "").trim() : "";

  const rows: SmileEdiRow[] = textRows.map((row, i) => ({
    excelRow: dataStartRowNumber + i,
    writeDate: cell(row, idx.writeDate),
    item: cell(row, idx.item),
    supplyAmount: cell(row, idx.supplyAmount),
    taxAmount: cell(row, idx.taxAmount),
    companyName: cell(row, idx.companyName),
    receiverDept: cell(row, idx.receiverDept),
    supplierManager: cell(row, idx.supplierManager),
    approvalNumber: cell(row, idx.approvalNumber),
    emailError: cell(row, idx.emailError),
  }));

  return { rows, emailErrorColIdx: idx.emailError };
}

/**
 * SharePoint 역발행 세금계산서 시트를 읽어 SmileEdiRow[]로 파싱.
 * - env: SHAREPOINT_SMILEEDI_DRIVE_ID / SHAREPOINT_SMILEEDI_ITEM_ID (누락 시 null)
 * - 헤더는 **행 3 고정** (Python pd.read_excel(header=2)) → 데이터는 행 4부터
 * - display text 사용(날짜·금액 serial 회피)
 */
export async function fetchSmileEdiSheet(): Promise<SmileEdiSheet | null> {
  const driveId = process.env.SHAREPOINT_SMILEEDI_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_SMILEEDI_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[smileedi] SHAREPOINT_SMILEEDI_DRIVE_ID / SHAREPOINT_SMILEEDI_ITEM_ID 환경 변수 누락",
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[smileedi] graph token error:", e);
    return null;
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;
  let sessionId: string | null = null;
  try {
    sessionId = await getWorkbookSession(driveId, itemId);
  } catch {
    sessionId = null;
  }
  const reqHeaders: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (sessionId) reqHeaders["workbook-session-id"] = sessionId;

  const wsRes = await fetch(`${base}/worksheets?$top=1&$select=name`, {
    headers: reqHeaders,
    cache: "no-store",
  });
  if (!wsRes.ok) {
    console.error("[smileedi] worksheets fail:", wsRes.status, await wsRes.text());
    return null;
  }
  const wsJson = (await wsRes.json()) as { value?: { name: string }[] };
  const worksheetName = wsJson.value?.[0]?.name;
  if (!worksheetName) {
    console.warn("[smileedi] 워크시트가 비어 있습니다");
    return null;
  }

  const encoded = encodeURIComponent(worksheetName);
  const rangeRes = await fetch(
    `${base}/worksheets('${encoded}')/usedRange?$select=text`,
    { headers: reqHeaders, cache: "no-store" },
  );
  if (!rangeRes.ok) {
    console.error("[smileedi] usedRange fail:", rangeRes.status, await rangeRes.text());
    return null;
  }
  const data = (await rangeRes.json()) as { text?: string[][] };
  const textValues = data.text ?? [];

  // 헤더 행3 고정 (0-based index 2). 데이터는 시트 행4부터.
  const HEADER_INDEX = 2;
  if (textValues.length <= HEADER_INDEX) {
    console.warn("[smileedi] 행3 헤더를 찾을 수 없습니다 (데이터 부족)");
    return {
      worksheetName,
      rows: [],
      emailErrorColIdx: -1,
      fetchedAt: new Date().toISOString(),
    };
  }
  const headers = (textValues[HEADER_INDEX] ?? []).map((h) => String(h ?? ""));
  const dataRows = textValues.slice(HEADER_INDEX + 1);
  const { rows, emailErrorColIdx } = parseSmileEdiRows(
    headers,
    dataRows,
    HEADER_INDEX + 2, // 1-based 첫 데이터 행 (행4)
  );

  return {
    worksheetName,
    rows,
    emailErrorColIdx,
    fetchedAt: new Date().toISOString(),
  };
}
