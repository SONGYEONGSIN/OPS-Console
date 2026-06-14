import "server-only";
import { getGraphToken } from "./auth";
import { getWorkbookSession } from "./workbook-session";

/**
 * 공문관리대장(SharePoint Excel) — 경위서 발송 시 시행번호 채번 + 발신 시트 행추가.
 *
 * 시행번호 = "운영" + YY + MM + "-" + DD + 일련번호2자리(그날 순번).
 *   예) 운영2512-1603 = 2025-12-16 그날 3번째
 * 발신 시트: `(발신){YYYY}년` (현재 연도). 컬럼 A순번 B시행번호 C날짜 D수신 E제목 F링크 G담당자.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

/** 시행번호 prefix — 운영{YY}{MM}-{DD} */
export function formatDocPrefix(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `운영${yy}${mm}-${dd}`;
}

/** 기존 시행번호 목록 + 날짜 → 다음 시행번호 (그날 최대 순번 + 1, 없으면 01). */
export function nextDocNumber(existing: string[], date: Date): string {
  const prefix = formatDocPrefix(date);
  const re = new RegExp(`^${prefix}(\\d{2})$`);
  let max = 0;
  for (const raw of existing) {
    const m = re.exec(String(raw).trim());
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}${String(max + 1).padStart(2, "0")}`;
}

/** 현재 연도 발신 시트명. */
export function senderSheetName(year: number): string {
  return `(발신)${year}년`;
}

type UsedRange = {
  address?: string;
  text?: string[][];
  rowCount?: number;
};

async function fetchUsedRange(
  driveId: string,
  itemId: string,
  sheet: string,
  sessionId: string,
): Promise<UsedRange> {
  const token = await getGraphToken();
  const url = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(
    sheet,
  )}')/usedRange?$select=address,text,rowCount`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      "workbook-session-id": sessionId,
    },
  });
  if (!res.ok) {
    throw new Error(
      `[gongmun] usedRange ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return res.json();
}

/** 발신 시트 B열(시행번호) 값 전체 — 채번 입력용. */
export async function fetchSenderDocNumbers(
  driveId: string,
  itemId: string,
  year: number,
): Promise<string[]> {
  const sessionId = await getWorkbookSession(driveId, itemId);
  const used = await fetchUsedRange(
    driveId,
    itemId,
    senderSheetName(year),
    sessionId,
  );
  const text = used.text ?? [];
  return text.map((row) => String(row?.[1] ?? "").trim()).filter(Boolean);
}

/** 주소 '(발신)2026년'!A2:H104 → 시작 Excel 행번호(2). 파싱 실패 시 1. */
function startRowFromAddress(address: string | undefined): number {
  if (!address) return 1;
  const m = /![A-Z]+(\d+):/.exec(address);
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * usedRange B열(시행번호) 값 배열에서 docNumber와 **정확히 일치**하는 행의 인덱스.
 * 인덱스는 usedRange text 배열 기준(헤더 포함). 못 찾으면 -1. 부분 일치는 매칭 안 함.
 */
export function findSenderRowIndex(
  bColumnValues: (string | null)[],
  docNumber: string,
): number {
  const target = String(docNumber).trim();
  return bColumnValues.findIndex(
    (v) => String(v ?? "").trim() === target,
  );
}

export type LedgerRow = {
  docNumber: string;
  date: string; // YYYY-MM-DD
  recipient: string;
  title: string;
  link: string;
  author: string;
};

/**
 * 발신 시트 마지막 데이터 행 다음에 1행 추가.
 * 순번(A) = 직전 행 순번 + 1 (숫자 아니면 데이터 행 수 기반).
 */
export async function appendSenderRow(
  driveId: string,
  itemId: string,
  year: number,
  row: LedgerRow,
): Promise<void> {
  const sheet = senderSheetName(year);
  const sessionId = await getWorkbookSession(driveId, itemId);
  const used = await fetchUsedRange(driveId, itemId, sheet, sessionId);
  const text = used.text ?? [];
  const startRow = startRowFromAddress(used.address);

  // 마지막으로 B열(시행번호)이 채워진 행 인덱스
  let lastIdx = -1;
  for (let i = 0; i < text.length; i++) {
    if (String(text[i]?.[1] ?? "").trim()) lastIdx = i;
  }
  const lastSeqRaw = lastIdx >= 0 ? String(text[lastIdx]?.[0] ?? "").trim() : "";
  const lastSeq = Number(lastSeqRaw);
  const nextSeq = Number.isFinite(lastSeq) && lastSeq > 0 ? lastSeq + 1 : lastIdx + 2;
  const nextExcelRow = startRow + (lastIdx >= 0 ? lastIdx : text.length) + 1;

  const address = `A${nextExcelRow}:G${nextExcelRow}`;
  const token = await getGraphToken();
  const url = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(
    sheet,
  )}')/range(address='${encodeURIComponent(address)}')`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "workbook-session-id": sessionId,
    },
    body: JSON.stringify({
      values: [
        [
          nextSeq,
          row.docNumber,
          row.date,
          row.recipient,
          row.title,
          row.link,
          row.author,
        ],
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(
      `[gongmun] append ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
}

/**
 * 발신 시트에서 B열(시행번호)===docNumber 인 행을 찾아 그 행의 F열(링크)만 PATCH.
 * 발번 시 append로 빈칸 들어간 F를 발송 시점에 파일 링크로 채우는 용도.
 * 행을 찾아 PATCH하면 true, 못 찾으면 false.
 */
export async function updateSenderRowLink(
  driveId: string,
  itemId: string,
  year: number,
  docNumber: string,
  link: string,
): Promise<boolean> {
  const sheet = senderSheetName(year);
  const sessionId = await getWorkbookSession(driveId, itemId);
  const used = await fetchUsedRange(driveId, itemId, sheet, sessionId);
  const text = used.text ?? [];
  const startRow = startRowFromAddress(used.address);

  const idx = findSenderRowIndex(
    text.map((row) => (row?.[1] ?? null) as string | null),
    docNumber,
  );
  if (idx < 0) return false;

  const excelRow = startRow + idx;
  const address = `F${excelRow}:F${excelRow}`;
  const token = await getGraphToken();
  const url = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(
    sheet,
  )}')/range(address='${encodeURIComponent(address)}')`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "workbook-session-id": sessionId,
    },
    body: JSON.stringify({ values: [[link]] }),
  });
  if (!res.ok) {
    throw new Error(
      `[gongmun] updateLink ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return true;
}

/**
 * 발신 시트에서 B열(시행번호)===docNumber 인 행을 찾아 그 행 전체를 삭제(아래 행 위로 당김).
 * 승인취소로 시행번호를 회수할 때 사용 — updateSenderRowLink와 동일한 행찾기/주소 패턴.
 * 행을 찾아 삭제하면 true, 정확 일치 행이 없으면 아무것도 안 하고 false.
 */
export async function deleteSenderRow(
  driveId: string,
  itemId: string,
  year: number,
  docNumber: string,
): Promise<boolean> {
  const sheet = senderSheetName(year);
  const sessionId = await getWorkbookSession(driveId, itemId);
  const used = await fetchUsedRange(driveId, itemId, sheet, sessionId);
  const text = used.text ?? [];
  const startRow = startRowFromAddress(used.address);

  const idx = findSenderRowIndex(
    text.map((row) => (row?.[1] ?? null) as string | null),
    docNumber,
  );
  if (idx < 0) return false;

  const excelRow = startRow + idx;
  const address = `A${excelRow}:G${excelRow}`;
  const token = await getGraphToken();
  const url = `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(
    sheet,
  )}')/range(address='${encodeURIComponent(address)}')/delete`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "workbook-session-id": sessionId,
    },
    body: JSON.stringify({ shift: "Up" }),
  });
  if (!res.ok) {
    throw new Error(
      `[gongmun] deleteRow ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return true;
}
