import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import {
  LEDGER_SHEET_BASE,
  ManualSourceError,
  SCHEDULE_SHEET_BASE,
  parseActiveTasks,
  parseLedgerSheet,
  pickSheetName,
} from "./parse";
import type { ManualFolderFile, ManualSource } from "./types";

const GRAPH = "https://graph.microsoft.com/v1.0";
/** nextLink 를 끝없이 주는 응답에 갇히지 않게 — 200건씩이라 1만 건이다. */
const MAX_PAGES = 50;
const CHILD_SELECT = "id,name,webUrl,lastModifiedDateTime,cTag,file";

/**
 * 구성표 파일은 경로가 아니라 item id 로 찾는다 — 파일명에 '최종'·'개편안' 이
 * 붙었다 떨어지는 관행이라 경로는 깨진다. item id 는 이름이 바뀌어도 유지된다.
 */
export const MANUAL_SOURCE_ENV = [
  "SHAREPOINT_DRIVE_ID",
  "SHAREPOINT_MANUAL_ITEM_ID",
  "SHAREPOINT_MANUAL_LEDGER_ITEM_ID",
] as const;

type GraphChild = {
  id: string;
  name: string;
  webUrl?: string | null;
  lastModifiedDateTime?: string | null;
  cTag?: string | null;
  file?: unknown;
};

export function folderChildrenUrl(driveId: string, folderId: string): string {
  return `${GRAPH}/drives/${driveId}/items/${folderId}/children?$top=200&$select=${CHILD_SELECT}`;
}

export function worksheetsUrl(driveId: string, itemId: string): string {
  return `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets?$select=name`;
}

export function sheetValuesUrl(
  driveId: string,
  itemId: string,
  sheet: string,
): string {
  const name = encodeURIComponent(sheet.replace(/'/g, "''"));
  return `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${name}')/usedRange(valuesOnly=true)?$select=values`;
}

async function graphGet(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

async function readSheet(
  url: string,
  token: string,
  label: string,
): Promise<unknown[][]> {
  const res = await graphGet(url, token);
  if (!res.ok) {
    console.error(`[manual-ledger] sheet fail: ${label}`, res.status);
    throw new ManualSourceError(`${label} 읽기 실패 (${res.status})`);
  }
  const body = (await res.json()) as { values?: unknown[][] };
  return body.values ?? [];
}

/** 구성표의 시트 이름 목록. */
async function listSheetNames(url: string, token: string): Promise<string[]> {
  const res = await graphGet(url, token);
  if (!res.ok) {
    console.error("[manual-ledger] sheet list fail", res.status);
    throw new ManualSourceError(`시트 목록 읽기 실패 (${res.status})`);
  }
  const body = (await res.json()) as { value?: { name?: string }[] };
  return (body.value ?? []).flatMap((s) => (s.name ? [s.name] : []));
}

const toFile = (c: GraphChild): ManualFolderFile => ({
  id: c.id,
  name: c.name,
  webUrl: c.webUrl ?? null,
  lastModifiedDateTime: c.lastModifiedDateTime ?? null,
  cTag: c.cTag ?? null,
});

/** 폴더 바로 아래 파일만(하위 폴더는 따라가지 않는다 — 대장이 가리키는 문서는 모두 최상위). */
async function listFolderFiles(
  url: string,
  token: string,
): Promise<ManualFolderFile[]> {
  const items: GraphChild[] = [];
  let next: string | undefined = url;
  for (let page = 0; next; page++) {
    if (page >= MAX_PAGES)
      throw new ManualSourceError("매뉴얼 폴더 목록이 너무 깁니다.");
    const res = await graphGet(next, token);
    if (!res.ok) {
      console.error("[manual-ledger] list fail", res.status);
      throw new ManualSourceError(`매뉴얼 폴더 읽기 실패 (${res.status})`);
    }
    const body = (await res.json()) as {
      value?: GraphChild[];
      "@odata.nextLink"?: string;
    };
    items.push(...(body.value ?? []));
    next = body["@odata.nextLink"];
    // 토큰을 실어 보내므로 Graph 밖 주소는 따라가지 않는다.
    if (next && !next.startsWith(`${GRAPH}/`)) {
      throw new ManualSourceError(
        "매뉴얼 폴더 목록의 다음 쪽 주소가 올바르지 않습니다.",
      );
    }
  }
  return items.filter((i) => i.file).map(toFile);
}

async function connect(): Promise<{
  driveId: string;
  folderId: string;
  ledgerId: string;
  token: string;
}> {
  const missing = MANUAL_SOURCE_ENV.filter((n) => !process.env[n]);
  if (missing.length > 0) {
    console.error("[manual-ledger] env 누락:", missing.join(", "));
    throw new ManualSourceError("매뉴얼 원천 설정이 없습니다.");
  }
  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[manual-ledger] graph token error:", e);
    throw new ManualSourceError("Microsoft 인증에 실패했습니다.");
  }
  return {
    driveId: process.env.SHAREPOINT_DRIVE_ID ?? "",
    folderId: process.env.SHAREPOINT_MANUAL_ITEM_ID ?? "",
    ledgerId: process.env.SHAREPOINT_MANUAL_LEDGER_ITEM_ID ?? "",
    token,
  };
}

/** 대장·연간 일정·매뉴얼 폴더를 한 번에 읽는다. GET 만 부른다. */
export async function fetchManualSource(): Promise<ManualSource> {
  const { driveId, folderId, ledgerId, token } = await connect();
  const names = await listSheetNames(worksheetsUrl(driveId, ledgerId), token);
  const ledgerSheet = pickSheetName(names, LEDGER_SHEET_BASE);
  const scheduleSheet = pickSheetName(names, SCHEDULE_SHEET_BASE);
  const [ledgerValues, scheduleValues, files] = await Promise.all([
    readSheet(
      sheetValuesUrl(driveId, ledgerId, ledgerSheet),
      token,
      "매뉴얼 대장",
    ),
    readSheet(
      sheetValuesUrl(driveId, ledgerId, scheduleSheet),
      token,
      "연간 일정",
    ),
    listFolderFiles(folderChildrenUrl(driveId, folderId), token),
  ]);
  return {
    ledger: parseLedgerSheet(ledgerValues),
    activeTasks: parseActiveTasks(scheduleValues),
    files,
  };
}
