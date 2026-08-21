/**
 * SharePoint·Teams 파일 링크 → Graph `/shares/{token}` 토큰.
 *
 * 링크 모양이 제각각이다 — 채널 파일, 채팅 파일, `공유` 버튼이 만든 링크, 주소창에서
 * 복사한 것. 모양마다 파싱하면 **새 형태가 나올 때마다 깨진다.** Graph 의
 * `/shares/{token}/driveItem` 은 URL 을 그대로 감싸면 알아서 풀어주므로, 우리는
 * 감싸기만 하고 해석은 Graph 에 맡긴다.
 *
 * 인코딩 규칙(Microsoft 문서): `u!` + base64url(URL), 패딩 `=` 제거.
 */

/** 우리 테넌트의 파일만 받는다 — 남의 링크를 Graph 에 그대로 보내지 않는다. */
const ALLOWED_HOST = /(^|\.)sharepoint\.com$/i;

export function toSharingToken(url: string): string {
  const trimmed = url.trim();

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("링크가 아닙니다. SharePoint·Teams 파일 링크를 붙여넣으세요.");
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("http(s) 링크만 받습니다.");
  }
  if (!ALLOWED_HOST.test(parsed.hostname)) {
    throw new Error(
      "사내 SharePoint·Teams 파일 링크만 받습니다 (sharepoint.com).",
    );
  }

  const b64 = Buffer.from(trimmed, "utf8").toString("base64");
  // base64url — `+/=` 가 남으면 경로에 넣을 때 깨진다.
  return `u!${b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_")}`;
}
