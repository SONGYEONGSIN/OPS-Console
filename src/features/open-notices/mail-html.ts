import { buildHtmlSignature, htmlEscape, type OperatorSig } from "@/lib/mail-signature";

/**
 * 오픈안내 본문(평문) → HTML.
 *
 * `mail-signature.ts` 의 `buildReplyHtml` 을 쓰지 않는 이유는 하나다 —
 * 그쪽은 `\n`→`<br>` 만 하는데 **HTML 은 연속 공백을 1칸으로 접는다.**
 * 오픈안내 초안은 콜론을 세로로 맞춘 표 모양이라, 그대로 내보내면
 * 에디터에서는 완벽하고 받은 편지함에서만 정렬이 무너진다.
 *
 * `white-space: pre-wrap` 은 쓰지 않는다 — Outlook 의 Word 렌더링 엔진이
 * 무시하고, 대학 담당자 수신 환경이 거기다. `mail-signature.ts` 가 회사명
 * 뒤에 `&nbsp;&nbsp;` 를 쓰는 것도 같은 이유로 보인다.
 */

/** 공백을 포함하지 않는 http(s) URL. */
const URL_RE = /https?:\/\/[^\s]+/g;

/**
 * 이스케이프 + 정렬 공백 보존.
 *
 * **선두 공백과 2칸 이상 런만** `&nbsp;` 로 바꾼다. 단일 공백까지 바꾸면
 * 좁은 화면에서 줄이 안 접혀 가로 스크롤이 생긴다.
 */
function escapeKeepingAlignment(segment: string, atLineStart: boolean): string {
  const escaped = htmlEscape(segment);
  const pattern = atLineStart ? /^ +| {2,}/g : / {2,}/g;
  return escaped.replace(pattern, (run) => "&nbsp;".repeat(run.length));
}

/** URL 을 앵커로, 나머지를 이스케이프+공백보존으로 처리한 한 줄. */
function lineToHtml(line: string): string {
  let out = "";
  let cursor = 0;
  for (const m of line.matchAll(URL_RE)) {
    const at = m.index ?? 0;
    out += escapeKeepingAlignment(line.slice(cursor, at), cursor === 0);
    // href 와 표시 텍스트 모두 이스케이프 — 따옴표가 속성을 깨고 나가지 못하게 한다.
    const url = htmlEscape(m[0]);
    out += `<a href="${url}">${url}</a>`;
    cursor = at + m[0].length;
  }
  out += escapeKeepingAlignment(line.slice(cursor), cursor === 0);
  return out;
}

/** 평문 본문 → HTML (줄바꿈 `<br>`, 정렬 공백 `&nbsp;`, URL 앵커). */
export function htmlifyOpenNoticeBody(plain: string): string {
  return plain.split("\n").map(lineToHtml).join("<br>");
}

/** 편집된 본문(평문) + 서명을 div 로 래핑한 발송 HTML. */
export function buildOpenNoticeHtml(body: string, op: OperatorSig): string {
  return `<div>${htmlifyOpenNoticeBody(body)}<br><br>${buildHtmlSignature(op)}</div>`;
}
