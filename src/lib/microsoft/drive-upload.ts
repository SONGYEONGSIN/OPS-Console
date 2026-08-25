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

/**
 * 4MB 를 넘는 파일 — Graph 업로드 세션으로 조각내어 올린다.
 *
 * 단순 PUT(`uploadFileToFolder`)은 4MB 미만 전용이다. 지식망에 넣으려는 문서는
 * 그보다 크다 — 처음 들어온 통합 규정집이 6.2MB 였다.
 *
 * **덮어쓰지 않는다.** `rename` 이라 같은 이름이 있으면 Graph 가 뒤에 번호를
 * 붙인다. 사람이 올린 파일이 남의 파일을 소리 없이 지우면 안 된다.
 */
export async function uploadLargeFileToFolder(
  driveId: string,
  folderItemId: string,
  fileName: string,
  content: Buffer,
  opts?: { token?: string; chunkSize?: number },
): Promise<UploadResult> {
  const token = opts?.token ?? (await getGraphToken());
  // Graph 규격: 조각은 320KiB 의 배수여야 한다. 기본 5MiB.
  const chunkSize = opts?.chunkSize ?? 5 * 320 * 1024 * 4;

  const sessionRes = await fetch(
    `${GRAPH}/drives/${driveId}/items/${folderItemId}:/${encodeURIComponent(
      fileName,
    )}:/createUploadSession`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        item: { "@microsoft.graph.conflictBehavior": "rename" },
      }),
    },
  );
  if (!sessionRes.ok) {
    throw new Error(
      `[drive-upload] createUploadSession ${sessionRes.status}: ${(
        await sessionRes.text()
      ).slice(0, 200)}`,
    );
  }
  const { uploadUrl } = (await sessionRes.json()) as { uploadUrl: string };

  const total = content.length;
  for (let start = 0; start < total; start += chunkSize) {
    const end = Math.min(start + chunkSize, total) - 1;
    const res = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        // 세션 URL 자체가 인증이다 — Authorization 을 붙이면 Graph 가 거절한다.
        "Content-Range": `bytes ${start}-${end}/${total}`,
      },
      body: new Uint8Array(content.subarray(start, end + 1)),
    });
    // 마지막 조각에서만 driveItem 이 온다(201/200). 중간은 202.
    if (res.status === 201 || res.status === 200) {
      const json = (await res.json()) as { id: string; webUrl: string };
      return { itemId: json.id, webUrl: json.webUrl };
    }
    if (res.status !== 202) {
      throw new Error(
        `[drive-upload] chunk ${start}-${end} ${res.status}: ${(
          await res.text()
        ).slice(0, 200)}`,
      );
    }
  }
  // 마지막 조각이 202 로 끝나면 파일이 안 만들어진 것이다 — 링크를 지어내지 않는다.
  throw new Error("[drive-upload] 업로드가 끝났는데 파일 정보를 못 받았습니다");
}
