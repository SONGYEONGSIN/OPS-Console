import "server-only";

import { getGraphToken } from "@/lib/microsoft/auth";
import { manualRowSchema, type ManualRow } from "./schemas";

/**
 * manuals 도메인 — SharePoint driveItem children read.
 *
 * SHAREPOINT_DRIVE_ID + SHAREPOINT_MANUAL_ITEM_ID 환경변수 의존.
 * 파일/폴더 혼합 children. workbook session 미사용 (Excel sheet API 아님).
 *
 * 401(InvalidAuthenticationToken) 시 token cache invalidate + 1회 재시도.
 */

const DRIVE_ID = process.env.SHAREPOINT_DRIVE_ID;
const ROOT_ITEM_ID = process.env.SHAREPOINT_MANUAL_ITEM_ID;

const CATEGORY_REGEX = /^([A-Z])(\d+)?\./;

export function extractCategoryFromName(name: string): string | null {
  const m = CATEGORY_REGEX.exec(name);
  return m ? m[1] : null;
}

type GraphChild = {
  id: string;
  name: string;
  webUrl: string;
  folder?: { childCount?: number };
  file?: { mimeType?: string };
  size?: number;
  lastModifiedDateTime?: string;
  parentReference?: { id?: string; path?: string };
};

export function mapChildToManualRow(child: GraphChild): ManualRow {
  const kind = child.folder ? "folder" : "file";
  const row = {
    id: child.id,
    name: child.name,
    kind,
    webUrl: child.webUrl,
    parentItemId: child.parentReference?.id ?? null,
    category: kind === "folder" ? null : extractCategoryFromName(child.name),
    size: kind === "folder" ? null : (child.size ?? null),
    lastModifiedDateTime: child.lastModifiedDateTime ?? null,
    mimeType: kind === "folder" ? null : (child.file?.mimeType ?? null),
  };
  return manualRowSchema.parse(row);
}

const SELECT_FIELDS =
  "id,name,webUrl,folder,file,size,lastModifiedDateTime,parentReference";

async function fetchChildren(
  token: string,
  driveId: string,
  itemId: string,
): Promise<Response> {
  const url = `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${itemId}/children?$top=200&$select=${SELECT_FIELDS}`;
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

/**
 * 매뉴얼 폴더 children 조회.
 * - parentItemId 미지정 시 `SHAREPOINT_MANUAL_ITEM_ID` 루트 사용
 * - 401 응답 시 token cache invalidate + 1회 재시도
 * - 응답 children 정렬: folder 우선 → 이름 가나다순(ko)
 */
export async function listManualChildren(args?: {
  parentItemId?: string | null;
}): Promise<ManualRow[]> {
  if (!DRIVE_ID || !ROOT_ITEM_ID) {
    console.error(
      "[manuals] SHAREPOINT_DRIVE_ID / SHAREPOINT_MANUAL_ITEM_ID 환경 변수 누락",
    );
    return [];
  }
  const itemId = args?.parentItemId ?? ROOT_ITEM_ID;

  let token = await getGraphToken();
  let res = await fetchChildren(token, DRIVE_ID, itemId);
  if (res.status === 401) {
    token = await getGraphToken({ forceRefresh: true });
    res = await fetchChildren(token, DRIVE_ID, itemId);
  }
  if (!res.ok) {
    console.error(
      "[manuals] listChildren fail:",
      res.status,
      (await res.text()).slice(0, 200),
    );
    return [];
  }

  const json = (await res.json()) as { value?: GraphChild[] };
  const rows: ManualRow[] = [];
  for (const child of json.value ?? []) {
    try {
      rows.push(mapChildToManualRow(child));
    } catch (e) {
      console.error("[manuals] zod parse fail:", child.name, e);
    }
  }
  rows.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name, "ko");
  });
  return rows;
}
