import "server-only";
import { getGraphToken } from "@/lib/microsoft/auth";

/**
 * 주간보고 롤오버 전용 Graph I/O — SharePoint 폴더/파일 + 파일 콘텐츠 + 공유링크.
 * SharePoint 읽기/쓰기는 app-only 토큰(getGraphToken). docs/buseobogo.py 이식.
 * 시트 복제는 Graph Excel API에 copy 액션이 없어 파일을 내려받아 exceljs로 로컬 편집한다
 * (sheet-rollover.ts).
 */

const XLSX_CONTENT_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

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

/** drive item 파일 콘텐츠(.xlsx 바이트) 다운로드. */
export async function downloadItemContent(
  driveId: string,
  itemId: string,
): Promise<ArrayBuffer> {
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/content`,
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] download ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  return res.arrayBuffer();
}

/** drive item 파일 콘텐츠(.xlsx 바이트) 업로드(덮어쓰기). */
export async function uploadItemContent(
  driveId: string,
  itemId: string,
  data: ArrayBuffer,
): Promise<void> {
  const res = await authedFetch(
    `${GRAPH}/drives/${driveId}/items/${itemId}/content`,
    {
      method: "PUT",
      headers: { "content-type": XLSX_CONTENT_TYPE },
      body: data,
    },
  );
  if (!res.ok) {
    throw new Error(
      `[weekly-report] upload ${res.status}: ${(await res.text()).slice(0, 200)}`,
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
