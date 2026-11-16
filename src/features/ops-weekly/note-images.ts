import "server-only";

/**
 * 메모 HTML 의 그림 경로 — 저장·읽기 두 방향이 이 파일 하나에 있다.
 * 버킷이 비공개라 DB 에는 객체 경로만 남긴다(`<img data-ops-path="…">`, src 없음).
 * 화면에 내보낼 때 1시간 서명 URL 로 src 를 채운다. 편집기(RichNote)는 손대지 않는다 —
 * 붙여넣기 직후 src 에 서명 URL 이 들어가 있고, 저장할 때 여기서 경로로 되돌린다.
 */
import { sanitizeNoteHtml } from "@/features/checklist/note-html";
import { createAdminClient } from "@/lib/supabase/admin";
import { OPS_WEEKLY_BUCKET, OPS_WEEKLY_SIGNED_URL_TTL_SEC } from "./constants";
import type { ProjectEntryView } from "./merge";

const ALT = "첨부 이미지";
const MISSING = "[그림 없음]";
// 자리표시자 — 사설 영역 문자라 입력에서 먼저 지워 위조를 막는다.
const PH_OPEN = "";
const PH_CLOSE = "";
const PATH_RE = /^[0-9A-Za-z_./-]+$/;
const STORED_IMG_RE = /<img data-ops-path="([0-9A-Za-z_./-]+)"([^>]*)>/g;

/** 객체 경로 접두사(URL 아님). 업로드 경로와 저장 시 허용 범위가 이 함수 하나에서 나온다. */
export function opsWeeklyImagePrefix(
  weekStart: string,
  reportId: string,
): string {
  return `${weekStart}/${reportId}/`;
}

export function opsWeeklySignedUrlPrefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/sign/${OPS_WEEKLY_BUCKET}/`;
}

const attr = (tag: string, name: string): string | null =>
  new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? null;

const widthOf = (tag: string): string | null =>
  /\swidth\s*=\s*"?(\d+)"?/i.exec(tag)?.[1] ?? null;

function pathOf(tag: string, signedPrefix: string): string | null {
  const src = attr(tag, "src");
  if (src !== null && src.startsWith(signedPrefix)) {
    return src.slice(signedPrefix.length).split("?")[0];
  }
  return attr(tag, "data-ops-path");
}

const isOwnPath = (path: string, pathPrefix: string): boolean =>
  PATH_RE.test(path) &&
  !path.includes("..") &&
  path.startsWith(pathPrefix) &&
  path.length > pathPrefix.length;

const storedImg = (path: string, width: string | null): string =>
  `<img data-ops-path="${path}" alt="${ALT}"${width ? ` width="${width}"` : ""}>`;

/** 저장용 정화 — 그 보고서 경로의 그림만 `data-ops-path` 로 남기고 나머지는 sanitizeNoteHtml 에 맡긴다. */
export function toStoredNoteHtml(
  html: string,
  pathPrefix: string,
  signedPrefix: string = opsWeeklySignedUrlPrefix(),
): string {
  const kept: { path: string; width: string | null }[] = [];
  const marked = html
    .replaceAll(PH_OPEN, "")
    .replaceAll(PH_CLOSE, "")
    .replace(/<img\b[^>]*>/gi, (tag) => {
      const path = pathOf(tag, signedPrefix);
      if (path === null || !isOwnPath(path, pathPrefix)) return "";
      kept.push({ path, width: widthOf(tag) });
      return `${PH_OPEN}${kept.length - 1}${PH_CLOSE}`;
    });
  // 접두사가 빈 문자열이라 남은 <img> 는 전부 지워지고, 자리표시자는 <>&" 가 없어 이스케이프를 통과한다.
  return sanitizeNoteHtml(marked, "").replace(
    new RegExp(`${PH_OPEN}(\\d+)${PH_CLOSE}`, "g"),
    (_m, i: string) => {
      const img = kept[Number(i)];
      return img ? storedImg(img.path, img.width) : "";
    },
  );
}

/** `data-ops-path` 값을 처음 나온 순서로, 중복 없이. */
export function collectNoteImagePaths(htmls: readonly string[]): string[] {
  const paths = htmls.flatMap((h) =>
    Array.from(h.matchAll(STORED_IMG_RE), (m) => m[1]),
  );
  return [...new Set(paths)];
}

/** 경로의 `<week_start>/<reportId>/` 다음 부분 — 다른 보고서 경로로 옮길 때 이름을 그대로 쓴다. */
const restOf = (path: string): string => path.split("/").slice(2).join("/");

async function copyOne(from: string, to: string): Promise<boolean> {
  try {
    const { error } = await createAdminClient()
      .storage.from(OPS_WEEKLY_BUCKET)
      .copy(from, to);
    return error === null;
  } catch {
    return false;
  }
}

/**
 * 다른 보고서의 HTML(지난주 차주 미리 채우기)이 가리키는 그림을 `toPrefix` 경로로 복사하고 경로를 바꾼다.
 * 저장할 때 그 보고서 경로 밖 그림은 지워지므로, 복사하지 못한 그림은 여기서 뺀다 — 보이다가
 * 첫 저장에서 조용히 사라지는 참조를 남기지 않는다. 던지지 않는다(보고서 생성을 막지 않는다).
 */
export async function copyNoteImages(
  htmls: readonly string[],
  toPrefix: string,
): Promise<string[]> {
  const paths = collectNoteImagePaths(htmls);
  if (paths.length === 0) return [...htmls];
  const moved = new Map<string, string>();
  await Promise.all(
    paths.map(async (from) => {
      const to = from.startsWith(toPrefix) ? from : `${toPrefix}${restOf(from)}`;
      if (!isOwnPath(to, toPrefix)) return;
      if (to === from || (await copyOne(from, to))) moved.set(from, to);
    }),
  );
  return htmls.map((h) =>
    h.replace(STORED_IMG_RE, (_m, path: string, rest: string) => {
      const to = moved.get(path);
      return to === undefined ? "" : `<img data-ops-path="${to}"${rest}>`;
    }),
  );
}

const escapeAttr = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

/** 저장된 그림 태그에 서명 URL 을 채운다. 서명되지 않은 경로는 `[그림 없음]` 글자가 된다. */
export function fillNoteImageSrc(
  html: string,
  signed: ReadonlyMap<string, string>,
): string {
  return html.replace(STORED_IMG_RE, (_m, path: string, rest: string) => {
    const url = signed.get(path);
    if (url === undefined) return MISSING;
    const width = widthOf(rest);
    return `<img src="${escapeAttr(url)}" data-ops-path="${path}" alt="${ALT}"${
      width ? ` width="${width}"` : ""
    }>`;
  });
}

type SignedItem = {
  path: string | null;
  signedUrl: string;
  error: string | null;
};

/** 모든 HTML 의 그림을 `createSignedUrls` 한 번으로 서명한다. 입력과 같은 순서로 돌려준다. */
export async function signNoteImages(
  htmls: readonly string[],
): Promise<string[]> {
  const paths = collectNoteImagePaths(htmls);
  if (paths.length === 0) return [...htmls];
  const { data, error } = await createAdminClient()
    .storage.from(OPS_WEEKLY_BUCKET)
    .createSignedUrls(paths, OPS_WEEKLY_SIGNED_URL_TTL_SEC);
  // 조용히 그림을 다 지우지 않는다 — 호출 전체가 실패하면 던진다.
  if (error) throw new Error(`[ops-weekly] storage sign: ${error.message}`);
  const signed = new Map(
    ((data ?? []) as SignedItem[])
      .filter((d) => d.error === null && d.path !== null && d.signedUrl)
      .map((d) => [d.path as string, d.signedUrl]),
  );
  return htmls.map((h) => fillNoteImageSrc(h, signed));
}

/** entry 의 금주·차주 HTML 전부를 한 번에 서명한 새 배열(입력은 바꾸지 않는다). */
export async function signProjectEntries(
  entries: readonly ProjectEntryView[],
): Promise<ProjectEntryView[]> {
  const filled = await signNoteImages(
    entries.flatMap((e) => [e.thisWeek, e.nextWeek]),
  );
  return entries.map((e, i) => ({
    ...e,
    thisWeek: filled[2 * i],
    nextWeek: filled[2 * i + 1],
  }));
}
