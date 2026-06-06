export function incidentReportMailSubject(title: string): string {
  return `[진학어플라이] ${title} 경위서 전달 건`;
}

/** 발송 폼 기본 본문(편집 가능 텍스트) — 운영자가 발송 전 수정한다. */
export function incidentReportMailBody(args: {
  title: string;
  authorName: string;
}): string {
  return `안녕하세요.
진학어플라이 ${args.authorName}입니다.

${args.title} 관련하여, 경위서 전달드립니다.
첨부된 PDF 확인 부탁드립니다.

이번 일로 업무에 불편드린 점 진심으로 사과드립니다.
감사합니다.`;
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
