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
  type RawDocFile,
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

type IdentitySet = { user?: { email?: string | null } | null } | null;
type DriveItem = DriveFile & {
  folder?: unknown;
  file?: { hashes?: { quickXorHash?: string | null } | null } | null;
  createdBy?: IdentitySet;
  lastModifiedBy?: IdentitySet;
};

const CHILD_SELECT = "id,name,webUrl,size,lastModifiedDateTime,folder,file";
/** 업로드 알림용 — 화면이 받는 필드에 올린 사람만 더한다. 해시는 file facet(file.hashes.quickXorHash)에 온다. */
export const UPLOAD_CHILD_SELECT = `${CHILD_SELECT},createdBy,lastModifiedBy`;

export function childrenUrl(
  driveId: string,
  path: string,
  select: string = CHILD_SELECT,
): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${GRAPH}/drives/${driveId}/root:/${encoded}:/children?$top=200&$select=${select}`;
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
  select: string = CHILD_SELECT,
): Promise<DriveItem[]> {
  const items: DriveItem[] = [];
  let url: string | undefined = childrenUrl(driveId, path, select);
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

type DocEntry = { item: DriveItem; rel: string };

/** 제출 서류 폴더를 재귀로 훑어 파일만(확장자 무관) 모은다. */
async function walkDocs(
  driveId: string,
  token: string,
  path: string,
  rel: string,
  depth: number,
  select: string,
): Promise<DocEntry[]> {
  const items = await listChildren(
    driveId,
    path,
    token,
    "제출 서류 폴더",
    select,
  );
  const files: DocEntry[] = items
    .filter((i) => i.file)
    .map((item) => ({ item, rel }));
  if (depth >= MAX_DEPTH) return files;
  const nested = await Promise.all(
    items
      .filter((i) => i.folder)
      .map((i) =>
        walkDocs(
          driveId,
          token,
          `${path}/${i.name}`,
          rel ? `${rel}/${i.name}` : i.name,
          depth + 1,
          select,
        ),
      ),
  );
  return [...files, ...nested.flat()];
}

async function walkPdfs(
  driveId: string,
  token: string,
  path: string,
  rel: string,
  depth: number,
): Promise<RawPdf[]> {
  const entries = await walkDocs(
    driveId,
    token,
    path,
    rel,
    depth,
    CHILD_SELECT,
  );
  return entries
    .filter(({ item }) => /\.pdf$/i.test(item.name))
    .map(({ item, rel: folder }) => ({ ...toDriveFile(item), folder }));
}

const normEmail = (who: IdentitySet | undefined): string | null => {
  const email = who?.user?.email?.trim().toLowerCase();
  return email ? email : null;
};

const toRawDocFile = ({ item, rel }: DocEntry): RawDocFile => ({
  id: item.id,
  name: item.name,
  folder: rel,
  webUrl: item.webUrl ?? null,
  hash: item.file?.hashes?.quickXorHash ?? null,
  createdByEmail: normEmail(item.createdBy),
  modifiedByEmail: normEmail(item.lastModifiedBy),
});

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

async function connectGraph(): Promise<{ driveId: string; token: string }> {
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
  return { driveId, token };
}

/** 업로드 알림용 — 제출 서류 폴더 아래 모든 파일(PDF 외 포함)과 해시·올린 사람. */
export async function fetchDocFiles(): Promise<RawDocFile[]> {
  const { driveId, token } = await connectGraph();
  const entries = await walkDocs(
    driveId,
    token,
    `${SMS_ROOT_PATH}/${DOCS_FOLDER}`,
    "",
    0,
    UPLOAD_CHILD_SELECT,
  );
  return entries.map(toRawDocFile);
}

export async function fetchSmsSenderSource(): Promise<RawSource> {
  const { driveId, token } = await connectGraph();

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
