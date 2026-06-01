import "server-only";
import { getGraphToken } from "./auth";

/**
 * SharePoint 드라이브 폴더에 파일 업로드 — Graph driveItem 단순 PUT.
 * 4MB 미만 파일용 (경위서 .docx는 작음). 폴더 itemId 하위에 파일명으로 생성/덮어쓰기.
 *
 * 현재는 client_credentials(서비스 계정)로 업로드 → "만든 사람"=서비스 계정.
 * Phase D에서 위임 토큰으로 교체하면 "만든 사람"=운영자.
 */

const GRAPH = "https://graph.microsoft.com/v1.0";

export type UploadResult = { itemId: string; webUrl: string };

export async function uploadFileToFolder(
  driveId: string,
  folderItemId: string,
  fileName: string,
  content: Buffer,
  contentType: string,
  opts?: { token?: string },
): Promise<UploadResult> {
  const token = opts?.token ?? (await getGraphToken());
  const url = `${GRAPH}/drives/${driveId}/items/${folderItemId}:/${encodeURIComponent(
    fileName,
  )}:/content`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "content-type": contentType,
    },
    body: new Uint8Array(content),
  });
  if (!res.ok) {
    throw new Error(
      `[drive-upload] PUT ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  }
  const json = (await res.json()) as { id: string; webUrl: string };
  return { itemId: json.id, webUrl: json.webUrl };
}
