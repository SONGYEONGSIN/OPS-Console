import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";
import { getWorkbookSession } from "@/lib/microsoft/workbook-session";

/**
 * 주간보고 롤오버 전용 Graph I/O — SharePoint 폴더/파일 + 워크북 셀 + 공유링크.
 * SharePoint 읽기/쓰기는 app-only 토큰(getGraphToken). docs/buseobogo.py 이식.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type DriveFile = {
  id: string;
  name: string;
  lastModifiedDateTime: string;
};

async function authedFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await getGraphToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
}

/** 폴더(경로)의 파일 목록 — 폴더가 없으면 빈 배열. */
export async function listFolderFiles(
  driveId: string,
  folderPath: string,
): Promise<DriveFile[]> {
  const enc = encodeURIComponent(folderPath);
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/root:/${enc}:/children?$top=200&$select=id,name,lastModifiedDateTime,folder`,
  );
  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(
      `[weekly-report] list ${folderPath} ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    value: Array<DriveFile & { folder?: unknown }>;
  };
  return json.value
    .filter((it) => !it.folder)
    .map((it) => ({
      id: it.id,
      name: it.name,
      lastModifiedDateTime: it.lastModifiedDateTime,
    }));
}

/**
 * 후보 경로들을 순서대로 시도해, prefix에 맞는 보고 파일이 있는 폴더를 찾는다.
 * 반환: 폴더 경로 + prefix 매칭 파일 중 lastModifiedDateTime 최신 + 형제 매칭 파일들.
 */
export async function findReportFolder(
  driveId: string,
  candidatePaths: readonly string[],
  prefix: string,
): Promise<{
  folderPath: string;
  latest: DriveFile;
  siblings: DriveFile[];
} | null> {
  for (const folderPath of candidatePaths) {
    const files = await listFolderFiles(driveId, folderPath);
    const matched = files.filter((f) => f.name.includes(prefix));
    if (matched.length === 0) continue;
    const latest = matched.reduce((a, b) =>
      a.lastModifiedDateTime >= b.lastModifiedDateTime ? a : b,
    );
    return { folderPath, latest, siblings: matched };
  }
  return null;
}

/** drive item을 새 이름으로 같은 폴더에 복사 (비동기 — 완료까지 폴링). */
export async function copyItemAndWait(
  driveId: string,
  itemId: string,
  newName: string,
  maxPolls = 30,
): Promise<string> {
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/copy`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: newName }),
    },
  );
  if (res.status !== 202) {
    throw new Error(
      `[weekly-report] copy ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const monitorUrl = res.headers.get("location");
  if (!monitorUrl) throw new Error("[weekly-report] copy: Location 헤더 없음");
  for (let i = 0; i < maxPolls; i++) {
    const mon = await fetch(monitorUrl);
    const status = (await mon.json().catch(() => ({}))) as {
      status?: string;
      resourceId?: string;
    };
    if (status.status === "completed" && status.resourceId) {
      return status.resourceId;
    }
    if (status.status === "failed") {
      throw new Error("[weekly-report] copy 작업 실패");
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("[weekly-report] copy 폴링 타임아웃");
}

/** 워크북 시트명 목록 (위치 순). */
export async function listWorksheetNames(
  driveId: string,
  itemId: string,
): Promise<string[]> {
  const session = await getWorkbookSession(driveId, itemId);
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets?$select=name,position`,
    { headers: { "workbook-session-id": session } },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] worksheets ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as {
    value: Array<{ name: string; position: number }>;
  };
  return json.value.sort((a, b) => a.position - b.position).map((w) => w.name);
}

/** 워크북 시트 이름 변경. */
export async function renameWorksheet(
  driveId: string,
  itemId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const session = await getWorkbookSession(driveId, itemId);
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(oldName)}`,
    {
      method: "PATCH",
      headers: {
        "workbook-session-id": session,
        "content-type": "application/json",
      },
      body: JSON.stringify({ name: newName }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] rename sheet ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
}

/** 단일 셀 값(텍스트) 읽기. 비어있으면 "". */
export async function getCellText(
  driveId: string,
  itemId: string,
  sheetName: string,
  address: string,
): Promise<string> {
  const session = await getWorkbookSession(driveId, itemId);
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${address}')?$select=text,values`,
    { headers: { "workbook-session-id": session } },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] getCell ${address} ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { text?: string[][]; values?: unknown[][] };
  const t = json.text?.[0]?.[0];
  return typeof t === "string" ? t : String(json.values?.[0]?.[0] ?? "");
}

/** 단일 셀 값(텍스트) 쓰기. */
export async function setCellText(
  driveId: string,
  itemId: string,
  sheetName: string,
  address: string,
  value: string,
): Promise<void> {
  const session = await getWorkbookSession(driveId, itemId);
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/workbook/worksheets/${encodeURIComponent(sheetName)}/range(address='${address}')`,
    {
      method: "PATCH",
      headers: {
        "workbook-session-id": session,
        "content-type": "application/json",
      },
      body: JSON.stringify({ values: [[value]] }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] setCell ${address} ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
}

/** 조직 공유 링크 생성(재사용) — createLink는 동일 type/scope 링크를 재사용. */
export async function createOrgShareLink(
  driveId: string,
  itemId: string,
  scope = "organization",
): Promise<string> {
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/createLink`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ type: "view", scope }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] createLink ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { link?: { webUrl?: string } };
  if (!json.link?.webUrl) {
    throw new Error("[weekly-report] createLink: webUrl 없음");
  }
  return json.link.webUrl;
}
