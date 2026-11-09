import { escapeHtml } from "@/features/receivables/mail-template";
import type { ReviewHalf } from "./half";
import type { ReviewIssue, ReviewItem, ReviewRecipient } from "./plan";

/**
 * 매뉴얼 점검 안내·관리자 요약 메일 HTML.
 *
 * 인라인 스타일만 쓴다(`open-notices/mail-html.ts` 의 Outlook 규칙). `white-space: pre-wrap`
 * 은 Outlook 이 무시하므로 쓰지 않고, 표는 table 태그로 만든다. Outlook 은 wrapper div 의
 * 글꼴을 table/td 로 상속하지 않아 요소마다 글꼴을 적는다.
 */

const FONT = "font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;";
const TEXT_STYLE = `${FONT}font-size:14px;`;
const HEAD_STYLE = `${FONT}font-size:15px;font-weight:bold;margin-top:18px;`;
const NOTICE_STYLE = `${FONT}font-size:12px;color:#888;`;
const CELL_STYLE = `${TEXT_STYLE}padding:4px 12px 4px 0;text-align:left;vertical-align:top;`;
const MUTED_STYLE = `${FONT}font-size:12px;color:#888;`;

const NOTICE = "이 메일은 매뉴얼 대장을 보고 자동으로 보냈습니다.";
const NO_FILE = "(파일을 찾지 못했습니다)";

const p = (text: string, style = TEXT_STYLE): string =>
  `<p style="${style}">${text}</p>`;

function table(headers: readonly string[], rows: string[][]): string {
  const head = headers
    .map((h) => `<th style="${CELL_STYLE}color:#666;">${h}</th>`)
    .join("");
  const body = rows
    .map(
      (cells) =>
        `<tr>${cells.map((c) => `<td style="${CELL_STYLE}">${c}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<table style="border-collapse:collapse;"><tr>${head}</tr>${body}</table>`;
}

function docCell(item: ReviewItem): string {
  const name = escapeHtml(item.docName);
  if (item.webUrl === null) {
    return `${name} <span style="${MUTED_STYLE}">${NO_FILE}</span>`;
  }
  if (!item.webUrl.startsWith("https://")) return name;
  return `<a href="${escapeHtml(item.webUrl)}" style="${TEXT_STYLE}">${name}</a>`;
}

const wrap = (inner: string): string =>
  `<div style="color:#222;">\n${inner}\n</div>`;

export function buildReviewMail(
  r: ReviewRecipient,
  half: ReviewHalf,
): { subject: string; html: string } {
  const subject = `[운영부] 매뉴얼 점검 안내 — ${half.label}`;
  const rows = r.items.map((item) => [
    escapeHtml(item.task),
    docCell(item),
    escapeHtml(item.lastModified ?? "-"),
  ]);
  const html = wrap(
    [
      p(`안녕하세요, ${escapeHtml(r.name)}님.`),
      p(
        `맡으신 진행 중 업무의 매뉴얼입니다. ${half.month}월 말까지 내용을 점검하고 바뀐 점을 반영해 주세요.`,
      ),
      table(["업무", "문서명", "최종 수정일"], rows),
      p(NOTICE, NOTICE_STYLE),
    ].join("\n"),
  );
  return { subject, html };
}

export type ReviewSummary = {
  recipients: number;
  notified: number;
  pending: number;
  manualCount: number;
  unresolvedOwners: ReviewIssue[];
  unlinked: ReviewIssue[];
};

/** 0건이어도 섹션을 지우지 않는다 — '없다' 와 '안 세어 봤다' 가 화면에서 같아진다. */
function issueSection(title: string, issues: ReviewIssue[]): string {
  const head = p(`${title} ${issues.length}건`, HEAD_STYLE);
  if (issues.length === 0) return `${head}\n${p("없음")}`;
  const rows = issues.map((i) => [
    escapeHtml(i.task),
    escapeHtml(i.docName),
    escapeHtml(i.ownerText),
  ]);
  return `${head}\n${table(["업무", "문서명", "담당자"], rows)}`;
}

export function buildSummaryMail(
  s: ReviewSummary,
  half: ReviewHalf,
): { subject: string; html: string } {
  const subject = `[운영부] 매뉴얼 점검 안내 발송 결과 — ${half.label}`;
  const pending =
    s.pending > 0
      ? [
          p(
            `아직 못 보낸 담당자 ${s.pending}명 — 이번 달 영업일마다 다시 보냅니다.`,
          ),
        ]
      : [];
  const html = wrap(
    [
      p(`${half.label} 매뉴얼 점검 안내를 보냈습니다.`),
      p(`안내를 받은 담당자 ${s.notified}명 / 대상 ${s.recipients}명`),
      p(`대상 매뉴얼 ${s.manualCount}건`),
      ...pending,
      issueSection("담당자 미확인", s.unresolvedOwners),
      issueSection("파일 연결 안 됨", s.unlinked),
      p(NOTICE, NOTICE_STYLE),
    ].join("\n"),
  );
  return { subject, html };
}
