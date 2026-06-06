import "server-only";
import { cache } from "react";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";

export type ReceivablesSheet = {
  worksheetName: string;
  /** 헤더 행보다 앞에 있는 메타 정보 행들 (예: [기준일], 매출채권 요약 등) */
  metaRows: unknown[][];
  headers: string[];
  /** raw values — 정렬/필터/숫자 비교용 */
  rows: unknown[][];
  /** Excel display text — 날짜/통화 등 표시 형식 그대로 (날짜 serial 회피) */
  rowsText: string[][];
  /** valid index → 원본 Excel 컬럼 인덱스 매핑 (PATCH cell address 계산용) */
  validColIdx: number[];
  /** 헤더 행의 sheet 1-based row 번호 (PATCH cell address 계산용) */
  headerRowNumber: number;
  rowCount: number;
  columnCount: number;
  fetchedAt: string;
};

/**
 * usedRange 안에서 헤더 행을 자동 감지.
 * 휴리스틱: 처음 10행 중 non-empty 셀 수가 가장 많은 행 (동률 시 첫 번째).
 * 사용자 도메인 (Excel 미수채권)에는 헤더 위에 [기준일] / 매출채권 요약 같은
 * 메타 행이 1~3개 들어있는 경우가 일반적.
 */
function detectHeaderIndex(values: unknown[][]): number {
  const lookAhead = Math.min(10, values.length);
  // 1순위: 알려진 헤더 라벨('청구일자')을 포함하는 첫 행.
  // 데이터행이 헤더보다 채워진 셀이 많을 수 있어(예: 학교담당자·메일발송일자·적요 동시 기입)
  // non-empty 최다 휴리스틱만으로는 데이터행을 헤더로 오검출한다 → 라벨 우선으로 방지.
  for (let i = 0; i < lookAhead; i++) {
    if (values[i].some((v) => /^청구\s*일자/.test(String(v ?? "").trim()))) {
      return i;
    }
  }
  // 2순위: non-empty 셀이 가장 많은 행 (라벨 미발견 시 폴백, 동률은 첫 행)
  let bestIdx = 0;
  let bestCount = -1;
  for (let i = 0; i < lookAhead; i++) {
    const count = values[i].filter(
      (v) => v !== null && v !== undefined && String(v).trim() !== "",
    ).length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/**
 * SharePoint Excel 미수채권 시트의 usedRange를 가져와 헤더/행으로 분해.
 * - 환경변수: SHAREPOINT_RECEIVABLES_DRIVE_ID, SHAREPOINT_RECEIVABLES_ITEM_ID
 * - 첫 번째 워크시트 자동 선택 (특정 시트 지정은 후속)
 * - 첫 행은 헤더로 가정
 * - 실패/없음 → null
 *
 * React cache로 래핑 — 같은 요청 내 중복 호출(페이지 fetch + 통합 검색 등)을
 * 단일 Graph 호출로 dedupe.
 */
export const fetchReceivablesSheet = cache(
  async function fetchReceivablesSheet(): Promise<ReceivablesSheet | null> {
  const driveId = process.env.SHAREPOINT_RECEIVABLES_DRIVE_ID;
  const itemId = process.env.SHAREPOINT_RECEIVABLES_ITEM_ID;
  if (!driveId || !itemId) {
    console.warn(
      "[receivables] SHAREPOINT_RECEIVABLES_DRIVE_ID / SHAREPOINT_RECEIVABLES_ITEM_ID 환경 변수 누락",
    );
    return null;
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[receivables] graph token error:", e);
    return null;
  }

  const base = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/workbook`;

  // PATCH와 같은 워크북 세션 사용 — PATCH 결과가 같은 세션 GET 에 즉시 반영됨.
  // 세션 발급 실패해도 (예: 처음 호출) 일반 GET 으로 fallback.
  let sessionId: string | null = null;
  try {
    sessionId = await getWorkbookSession(driveId, itemId);
  } catch {
    sessionId = null;
  }

  const reqHeaders: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (sessionId) reqHeaders["workbook-session-id"] = sessionId;

  // 1) 첫 워크시트 이름 — cache: 'no-store' 로 Next.js fetch 캐시 회피
  const wsRes = await fetch(`${base}/worksheets?$top=1&$select=name`, {
    headers: reqHeaders,
    cache: "no-store",
  });
  if (!wsRes.ok) {
    console.error("[receivables] worksheets fail:", wsRes.status, await wsRes.text());
    return null;
  }
  const wsJson = (await wsRes.json()) as { value?: { name: string }[] };
  const worksheetName = wsJson.value?.[0]?.name;
  if (!worksheetName) {
    console.warn("[receivables] 워크시트가 비어 있습니다");
    return null;
  }

  // 2) usedRange — 헤더 + 데이터 (text 동시 fetch: Excel display 형식 그대로)
  const encoded = encodeURIComponent(worksheetName);
  const rangeRes = await fetch(
    `${base}/worksheets('${encoded}')/usedRange?$select=values,text,address,rowCount,columnCount`,
    { headers: reqHeaders, cache: "no-store" },
  );
  if (!rangeRes.ok) {
    console.error("[receivables] usedRange fail:", rangeRes.status, await rangeRes.text());
    return null;
  }
  const data = (await rangeRes.json()) as {
    values?: unknown[][];
    text?: string[][];
    rowCount?: number;
    columnCount?: number;
    address?: string;
  };
  const values = data.values ?? [];
  const textValues = data.text ?? [];
  if (values.length === 0) {
    return {
      worksheetName,
      metaRows: [],
      headers: [],
      rows: [],
      rowsText: [],
      validColIdx: [],
      headerRowNumber: 1,
      rowCount: 0,
      columnCount: 0,
      fetchedAt: new Date().toISOString(),
    };
  }

  const headerIdx = detectHeaderIndex(values);
  const metaRows = values.slice(0, headerIdx);
  const headerRowRaw = values[headerIdx] ?? [];

  // 헤더 텍스트 정리 + 빈 헤더 컬럼은 제외 (청구일자 앞·적요 뒤 무의미한 컬럼 제거)
  const headersAll = headerRowRaw.map((h) =>
    String(h ?? "").replace(/[\r\n]+/g, " ").trim(),
  );
  const validIdx: number[] = [];
  for (let i = 0; i < headersAll.length; i++) {
    if (headersAll[i] !== "") validIdx.push(i);
  }
  const headers = validIdx.map((i) => headersAll[i]);

  const rawValueRows = values.slice(headerIdx + 1);
  const rawTextRows = textValues.slice(headerIdx + 1);
  const rows = rawValueRows.map((row) => validIdx.map((i) => row[i] ?? null));
  const rowsText = rawTextRows.map((row) =>
    validIdx.map((i) => String(row[i] ?? "")),
  );

  return {
    worksheetName,
    metaRows,
    headers,
    rows,
    rowsText,
    validColIdx: validIdx,
    headerRowNumber: headerIdx + 1, // 1-based row number for Excel address
    rowCount: rows.length,
    columnCount: headers.length,
    fetchedAt: new Date().toISOString(),
  };
});

/**
 * 컬럼 0-based 인덱스 → Excel 컬럼 letter (0→A, 25→Z, 26→AA).
 */
export function columnLetter(idx: number): string {
  let n = idx;
  let s = "";
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
