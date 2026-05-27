import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";
import {
  CONTRACT_SHEETS,
  type ContractRow,
  type ContractSheet,
} from "./schemas";

/**
 * contracts 도메인 — SharePoint Excel 다중 시트 read.
 *
 * SHAREPOINT_DRIVE_ID + SHAREPOINT_CONTRACTS_ITEM_ID 환경변수 의존.
 * 시트별 헤더 행은 `detectHeaderIndex` 휴리스틱으로 자동 감지.
 * 시트별 컬럼은 다르므로 *공통 최소 컬럼*은 헤더 매칭으로 평탄화, 전체 컬럼은
 * `raw` Record에 보존 (인스펙터 view에서 노출).
 */

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
const ITEM_ID = process.env.SHAREPOINT_CONTRACTS_ITEM_ID;

/**
 * enum value(짧은 라벨, URL 친화) → 실제 시트 이름 매핑.
 * "기타"는 SharePoint 시트명이 길어 short alias 사용.
 */
const SHEET_NAME_MAP: Record<ContractSheet, string> = {
  "4년제": "4년제",
  "전문대": "전문대",
  "초중고": "초중고",
  "대학원": "대학원",
  "기타": "기타(전문학교,모의논술,공공 등)",
};

function normalizeHeader(s: string): string {
  return s.replace(/\s+/g, "").trim();
}

/** 0-base 컬럼 인덱스 → Excel 컬럼 letter (A, B, ..., AA, AB, ...) */
function columnLetter(idx: number): string {
  let s = "";
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

function cellAddr(colIdx: number, rowNum: number): string | null {
  if (colIdx < 0) return null;
  return `${columnLetter(colIdx)}${rowNum}`;
}

/**
 * 헤더 행 인덱스 detect — 키워드 우선 + non-empty 셀 수 폴백.
 *
 * 4년제 시트처럼 row 0이 헤더이지만 일부 data row(예: 계약진행/다년계약/단독여부 등 옵션
 * 셀이 가득 채워진 row)가 헤더보다 셀 수가 많은 경우, 단순 max-count 휴리스틱이 잘못된
 * 행을 헤더로 판정하는 문제를 키워드 시그널로 회피.
 *
 * 1차: 첫 10행 중 정규화된 헤더 키워드("넘버링"/"대학명"/"학교명"/"기관명") 포함 행
 * 2차 (fallback): 첫 5행 중 non-empty 셀 가장 많은 행 (이전 로직 보존)
 */
export function detectHeaderIndex(text: string[][]): number {
  const HEADER_KEYWORDS = ["넘버링", "대학명", "학교명", "기관명"];
  const keywordLookAhead = Math.min(10, text.length);
  for (let i = 0; i < keywordLookAhead; i++) {
    const normalized = text[i].map((c) => normalizeHeader(String(c ?? "")));
    if (HEADER_KEYWORDS.some((kw) => normalized.includes(normalizeHeader(kw)))) {
      return i;
    }
  }
  // fallback: 기존 휴리스틱
  const fallbackLookAhead = Math.min(5, text.length);
  let bestIdx = 0;
  let bestCount = -1;
  for (let i = 0; i < fallbackLookAhead; i++) {
    const count = text[i].filter((v) => String(v ?? "").trim() !== "").length;
    if (count > bestCount) {
      bestCount = count;
      bestIdx = i;
    }
  }
  return bestIdx;
}

/** 헤더 후보 중 normalized 매칭으로 첫 일치 컬럼 인덱스 반환. 없으면 -1. */
function findColIdx(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader);
  for (const cand of candidates) {
    const idx = normalized.indexOf(normalizeHeader(cand));
    if (idx >= 0) return idx;
  }
  return -1;
}

async function fetchSheet(
  token: string,
  sessionId: string,
  sheetName: ContractSheet,
): Promise<ContractRow[]> {
  const actualSheetName = SHEET_NAME_MAP[sheetName];
  const url = `https://graph.microsoft.com/v1.0/drives/${DRIVE_ID}/items/${ITEM_ID}/workbook/worksheets('${encodeURIComponent(actualSheetName)}')/usedRange?$select=text,rowCount,columnCount`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      // workbook session으로 워크북 활성 메모리에서 처리 — 504 MaxRequestDurationExceeded 회피
      "workbook-session-id": sessionId,
    },
  });
  if (!res.ok) {
    console.error(
      `[contracts] ${sheetName} fetch ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
    return [];
  }
  const json = (await res.json()) as {
    text: string[][];
    rowCount: number;
    columnCount: number;
  };
  const text = json.text ?? [];
  if (text.length === 0) return [];

  const headerIdx = detectHeaderIndex(text);
  const headers = text[headerIdx].map((c) => String(c ?? ""));
  const dataRows = text.slice(headerIdx + 1);

  const numberingIdx = findColIdx(headers, ["넘버링"]);
  const nameIdx = findColIdx(headers, ["대학명", "학교명", "기관명"]);
  const operatorIdx = findColIdx(headers, ["운영자"]);
  const statusIdx = findColIdx(headers, ["계약진행현황", "진행상태"]);
  const serviceActiveIdx = findColIdx(headers, ["서비스여부"]);
  const feeIdx = findColIdx(headers, ["수수료(VAT포함)", "수수료"]);

  const rows: ContractRow[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    const numbering =
      numberingIdx >= 0 ? String(row[numberingIdx] ?? "").trim() : "";
    const name = nameIdx >= 0 ? String(row[nameIdx] ?? "").trim() : "";
    // 빈 행 skip — 넘버링·이름 둘 다 없으면 무시
    if (!numbering && !name) continue;

    // Excel 1-based row 번호: headerIdx + (i+1) + 1
    const excelRowNumber = headerIdx + i + 2;
    const raw: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      const h = headers[j].trim();
      if (h) raw[h] = String(row[j] ?? "").trim();
    }
    rows.push({
      id: `${sheetName}-${excelRowNumber}`,
      sheet: sheetName,
      excelRowNumber,
      numbering,
      name,
      operator:
        operatorIdx >= 0 ? String(row[operatorIdx] ?? "").trim() : "",
      status: statusIdx >= 0 ? String(row[statusIdx] ?? "").trim() : "",
      serviceActive:
        serviceActiveIdx >= 0
          ? String(row[serviceActiveIdx] ?? "").trim()
          : "",
      feeAmount: feeIdx >= 0 ? String(row[feeIdx] ?? "").trim() : "",
      cellAddress: {
        operator: cellAddr(operatorIdx, excelRowNumber),
        status: cellAddr(statusIdx, excelRowNumber),
        serviceActive: cellAddr(serviceActiveIdx, excelRowNumber),
        feeAmount: cellAddr(feeIdx, excelRowNumber),
      },
      raw,
    });
  }
  return rows;
}

export type ContractsFilter = {
  sheet?: ContractSheet;
};

export type ContractsListResult = {
  rows: ContractRow[];
  total: number;
};

/**
 * 다중 시트 동시 fetch (Promise.all). filter.sheet 지정 시 해당 시트만, 미지정 시
 * CONTRACT_SHEETS 전체. Graph 일시 실패 시 해당 시트 빈 배열로 폴백 (전체 차단 X).
 */
export async function listContracts(
  filter: ContractsFilter = {},
): Promise<ContractsListResult> {
  if (!DRIVE_ID || !ITEM_ID) {
    console.error(
      "[contracts] SHAREPOINT_DRIVE_ID / SHAREPOINT_CONTRACTS_ITEM_ID 환경변수 누락",
    );
    return { rows: [], total: 0 };
  }
  const token = await getGraphToken();
  // workbook session: 첫 호출이 워크북을 활성 메모리로 로드. 후속 5 시트 fetch가 빠름
  const sessionId = await getWorkbookSession(DRIVE_ID, ITEM_ID);
  const sheetsToFetch = filter.sheet ? [filter.sheet] : [...CONTRACT_SHEETS];
  const results = await Promise.all(
    sheetsToFetch.map((s) => fetchSheet(token, sessionId, s)),
  );
  const rows = results.flat();
  return { rows, total: rows.length };
}
