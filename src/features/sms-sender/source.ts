import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { pickLatestWorkbook } from "./parse";
import {
  CRITERIA_SHEET,
  DOCS_FOLDER,
  HIDDEN_SHEETS,
  SMS_ROOT_PATH,
  type DriveFile,
  type HiddenSheetKey,
  type RawPdf,
  type RawSource,
} from "./types";

/** 화면에 그대로 보여도 되는 짧은 한국어 메시지만 담는다. 토큰·URL·원문 본문은 로그로만. */
export class SourceFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SourceFetchError";
  }
}

const GRAPH = "https://graph.microsoft.com/v1.0";
const MAX_DEPTH = 4;
/** nextLink 를 끝없이 주는 응답에 갇히지 않게 — 200건씩이라 1만 건이다. */
const MAX_PAGES = 50;

type DriveItem = DriveFile & { folder?: unknown; file?: unknown };

export function childrenUrl(driveId: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${GRAPH}/drives/${driveId}/root:/${encoded}:/children?$top=200&$select=id,name,webUrl,size,lastModifiedDateTime,folder,file`;
}

export function usedRangeUrl(
  driveId: string,
  itemId: string,
  sheet: string,
): string {
  return `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets('${encodeURIComponent(sheet.replace(/'/g, "''"))}')/usedRange(valuesOnly=true)?$select=values`;
}

async function graphGet(url: string, token: string): Promise<Response> {
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

async function listChildren(
  driveId: string,
  path: string,
  token: string,
  label: string,
): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let url: string | undefined = childrenUrl(driveId, path);
  for (let page = 0; url; page++) {
    if (page >= MAX_PAGES) {
      console.error(`[sms-sender] list page cap: ${label}`, path);
      throw new SourceFetchError(`${label} 목록이 너무 깁니다.`);
    }
    const res = await graphGet(url, token);
    if (!res.ok) {
      console.error(`[sms-sender] list fail: ${label}`, res.status, path);
      throw new SourceFetchError(`${label} 목록 읽기 실패 (${res.status})`);
    }
    const body = (await res.json()) as {
      value?: DriveItem[];
      "@odata.nextLink"?: string;
    };
    items.push(...(body.value ?? []));
    const next = body["@odata.nextLink"];
    // 토큰을 실어 보내므로 Graph 밖 주소는 따라가지 않는다.
    if (next && !next.startsWith(`${GRAPH}/`)) {
      console.error(`[sms-sender] foreign nextLink: ${label}`, path);
      throw new SourceFetchError(`${label} 목록의 다음 쪽 주소가 올바르지 않습니다.`);
    }
    url = next;
  }
  return items;
}

const toDriveFile = (i: DriveItem): DriveFile => ({
  id: i.id,
  name: i.name,
  webUrl: i.webUrl,
  size: i.size,
  lastModifiedDateTime: i.lastModifiedDateTime,
});

async function walkPdfs(
  driveId: string,
  token: string,
  path: string,
  rel: string,
  depth: number,
): Promise<RawPdf[]> {
  const items = await listChildren(driveId, path, token, "제출 서류 폴더");
  const pdfs: RawPdf[] = items
    .filter((i) => i.file && /\.pdf$/i.test(i.name))
    .map((i) => ({ ...toDriveFile(i), folder: rel }));
  if (depth >= MAX_DEPTH) return pdfs;
  const nested = await Promise.all(
    items
      .filter((i) => i.folder)
      .map((i) =>
        walkPdfs(
          driveId,
          token,
          `${path}/${i.name}`,
          rel ? `${rel}/${i.name}` : i.name,
          depth + 1,
        ),
      ),
  );
  return [...pdfs, ...nested.flat()];
}

async function readSheet(
  driveId: string,
  token: string,
  itemId: string,
  sheet: string,
  optional: boolean,
): Promise<unknown[][] | null> {
  const res = await graphGet(usedRangeUrl(driveId, itemId, sheet), token);
  if (optional && res.status === 404) return null;
  if (!res.ok) {
    console.error(`[sms-sender] sheet fail: ${sheet}`, res.status);
    throw new SourceFetchError(`${sheet} 읽기 실패 (${res.status})`);
  }
  const body = (await res.json()) as { values?: unknown[][] };
  return body.values ?? [];
}

export async function fetchSmsSenderSource(): Promise<RawSource> {
  const driveId = process.env.SHAREPOINT_DRIVE_ID;
  if (!driveId) {
    console.error("[sms-sender] SHAREPOINT_DRIVE_ID 누락");
    throw new SourceFetchError("SharePoint 연결 설정이 없습니다.");
  }

  let token: string;
  try {
    token = await getGraphToken();
  } catch (e) {
    console.error("[sms-sender] graph token error:", e);
    throw new SourceFetchError("Microsoft 인증에 실패했습니다.");
  }

  const rootItems = await listChildren(
    driveId,
    SMS_ROOT_PATH,
    token,
    "현황 폴더",
  );
  const { latest, offRuleFiles } = pickLatestWorkbook(
    rootItems.filter((i) => i.file).map(toDriveFile),
  );
  if (!latest) {
    throw new SourceFetchError("현황 파일(…_YYMMDD.xlsm)을 찾지 못했습니다.");
  }

  const keys = Object.keys(HIDDEN_SHEETS) as HiddenSheetKey[];
  const [hidden, criteria, pdfs] = await Promise.all([
    Promise.all(
      keys.map((k) =>
        readSheet(driveId, token, latest.id, HIDDEN_SHEETS[k], false),
      ),
    ),
    readSheet(driveId, token, latest.id, CRITERIA_SHEET, true),
    walkPdfs(driveId, token, `${SMS_ROOT_PATH}/${DOCS_FOLDER}`, "", 0),
  ]);

  const sheets = Object.fromEntries(
    keys.map((k, i) => [k, hidden[i] ?? []]),
  ) as Record<HiddenSheetKey, unknown[][]>;

  return {
    workbook: latest,
    offRuleFiles,
    sheets,
    criteria,
    pdfs,
    fetchedAt: new Date().toISOString(),
  };
}
