/**
 * 유튜브 링크 → 프레임(embed) 주소.
 *
 * 뉴스레터에 링크로 걸면 읽는 사람이 그 페이지를 떠나야 본다. 프레임으로 넣으면
 * **그 자리에서 재생된다.**
 *
 * Shorts·watch·youtu.be 는 주소 모양이 다 달라 한 곳에서 갈라 받는다.
 * 유튜브가 아니면 `null` 을 준다 — 아무 주소나 프레임에 넣으면 그게 곧 남의 페이지를
 * 우리 화면 안에 띄우는 길이 된다.
 */

/** 유튜브 영상 id — 11자 고정, 안전한 문자만. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
]);

export function toYouTubeEmbed(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  // 호스트를 먼저 본다 — 경로만 보고 믿으면 남의 사이트가 `/embed/` 를 흉내 낼 수 있다.
  if (!YOUTUBE_HOSTS.has(parsed.hostname)) return null;

  const path = parsed.pathname.split("/").filter(Boolean);
  const id =
    parsed.searchParams.get("v") ??
    // /shorts/{id} · /embed/{id} · youtu.be/{id}
    (path[0] === "shorts" || path[0] === "embed" ? path[1] : path[0]);

  if (!id || !VIDEO_ID.test(id)) return null;
  return `https://www.youtube.com/embed/${id}`;
}
