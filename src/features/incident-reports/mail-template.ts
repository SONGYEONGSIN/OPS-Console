export function incidentReportMailSubject(title: string): string {
  return `[운영부 상황실] ${title} 경위서`;
}

/** 발송 폼 기본 본문(편집 가능 텍스트) — 운영자가 발송 전 수정한다. */
export function incidentReportMailBody(args: {
  university: string;
  title: string;
  authorName: string;
}): string {
  return `${args.university} 담당자님께,

[운영부 상황실] ${args.title} 관련 경위서를 첨부드립니다.
첨부된 PDF를 확인 부탁드립니다. 업무에 불편을 드린 점 진심으로 사과드립니다.

${args.authorName} 드림`;
}

/** 편집된 본문 텍스트 → 메일 HTML (escape + 줄바꿈 보존). */
export function incidentReportBodyToHtml(body: string): string {
  const esc = body
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br>");
  return `<div style="font-family:sans-serif;line-height:1.7;color:#15120c">${esc}</div>`;
}
