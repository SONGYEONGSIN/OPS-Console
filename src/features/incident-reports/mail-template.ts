export function incidentReportMailSubject(title: string): string {
  return `[운영부 상황실] ${title} 경위서`;
}

export function incidentReportMailHtml(args: {
  university: string;
  title: string;
  authorName: string;
}): string {
  return `<div style="font-family:sans-serif;line-height:1.7;color:#15120c">
  <p>${args.university} 담당자님께,</p>
  <p>[운영부 상황실] <strong>${args.title}</strong> 관련 경위서를 첨부드립니다.</p>
  <p>첨부된 PDF를 확인 부탁드립니다. 업무에 불편을 드린 점 진심으로 사과드립니다.</p>
  <p>${args.authorName} 드림</p>
</div>`;
}
