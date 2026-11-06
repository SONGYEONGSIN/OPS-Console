import { escapeHtml } from "@/features/receivables/mail-template";
import { pdfSchoolName } from "../parse";
import type { DueUpload } from "./reconcile";

const LEAD = "학교별 제출 서류 폴더에 파일이 올라왔습니다.";
const NOTICE = "이 메일은 학교별 제출 서류 폴더를 보고 자동으로 보냈습니다.";
const HEADERS = ["구분", "학교", "파일명", "단계 폴더"] as const;

// Outlook 은 wrapper div 의 글꼴을 table/td 로 상속하지 않아 요소마다 명시한다.
const FONT = "font-family:'Malgun Gothic','맑은 고딕',Arial,sans-serif;";
const TEXT_STYLE = `${FONT}font-size:14px;`;
const NOTICE_STYLE = `${FONT}font-size:12px;color:#888;`;
const CELL_STYLE = `${TEXT_STYLE}padding:4px 12px 4px 0;text-align:left;vertical-align:top;`;

type Line = {
  kind: DueUpload["kind"];
  school: string;
  name: string;
  folder: string;
  webUrl: string | null;
};

const toLine = ({ file, kind }: DueUpload): Line => ({
  kind,
  school: pdfSchoolName(file.name) ?? "-",
  name: file.name,
  folder: file.folder || "(최상위)",
  webUrl: file.webUrl,
});

// 새 파일 먼저, 그다음 학교, 그다음 파일명.
const byOrder = (a: Line, b: Line): number =>
  Number(a.kind !== "new") - Number(b.kind !== "new") ||
  a.school.localeCompare(b.school, "ko") ||
  a.name.localeCompare(b.name, "ko");

function fileCell(line: Line): string {
  const name = escapeHtml(line.name);
  if (!line.webUrl || !line.webUrl.startsWith("https://")) return name;
  return `<a href="${escapeHtml(line.webUrl)}" style="${TEXT_STYLE}">${name}</a>`;
}

function rowHtml(line: Line): string {
  const cells = [
    escapeHtml(line.kind === "new" ? "새 파일" : "교체"),
    escapeHtml(line.school),
    fileCell(line),
    escapeHtml(line.folder),
  ];
  return `<tr>${cells.map((c) => `<td style="${CELL_STYLE}">${c}</td>`).join("")}</tr>`;
}

export function buildUploadMail(uploads: DueUpload[]): {
  subject: string;
  html: string;
} {
  const subject = `[내부관리자] 학교별 제출 서류 ${uploads.length}건 업로드`;
  const head = `<tr>${HEADERS.map((h) => `<th style="${CELL_STYLE}color:#666;">${h}</th>`).join("")}</tr>`;
  const rows = uploads.map(toLine).sort(byOrder).map(rowHtml).join("");
  const html = `<div style="color:#222;">
<p style="${TEXT_STYLE}">${LEAD}</p>
<table style="border-collapse:collapse;">${head}${rows}</table>
<p style="${NOTICE_STYLE}">${NOTICE}</p>
</div>`;
  return { subject, html };
}
