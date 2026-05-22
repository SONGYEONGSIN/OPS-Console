export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function nl2br(s: string): string {
  return s.replace(/\n/g, "<br>");
}

/** 운영자 검토용 제목/본문 기본값 생성 (진학어플라이 브랜드). 편집 가능. */
export function buildDefaultDataRequestText(args: {
  operatorName: string;
  universityName: string;
  serviceName: string;
  writeStart: string;
  writeEnd: string;
}): { subject: string; body: string } {
  const { operatorName, universityName, serviceName, writeStart, writeEnd } = args;
  const subject = `[진학어플라이] ${universityName} ${serviceName} 인터넷 원서접수 자료 요청 건`;
  const lines = [
    "안녕하세요.",
    `진학어플라이 ${operatorName}입니다.`,
    "",
    `${universityName} ${serviceName} 인터넷 원서접수 서비스 진행 관련하여 메일드립니다.`,
    ...(writeStart && writeEnd ? [`(작년 일정 : ${writeStart} ~ ${writeEnd})`] : []),
    "",
    "[요청 항목]",
    "- 모집요강",
    "- 전산자료(레이아웃, 코드자료 등)",
    "- 원서작업에 필요한 추가 자료",
    "",
    "원활한 서비스 준비를 위해 최소 2주 전까지 자료 회신 요청드립니다.",
    "감사합니다.",
  ];
  return { subject, body: lines.join("\n") };
}

export function renderDataRequestHtml(args: { subject: string; body: string }): string {
  const safeBody = nl2br(escapeHtml(args.body));
  return `<!DOCTYPE html><html lang="ko"><body style="margin:0;padding:0;">
<div style="font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#222;font-size:14px;line-height:1.7;max-width:620px;margin:0 auto;padding:24px;">
  <div>${safeBody}</div>
  <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;">
    ※ 본 메일은 인터넷 원서접수 준비를 위해 시스템에서 자동 발송되었습니다.
  </div>
</div></body></html>`;
}
