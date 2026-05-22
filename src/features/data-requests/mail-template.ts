export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 진학어플라이 자료요청 고정 스타일 메일 생성 (제목 + HTML 본문). 변수만 자동 채움, 편집 불가. */
export function buildDataRequestMail(args: {
  operatorName: string;
  universityName: string;
  serviceName: string;
  writeStart: string;
  writeEnd: string;
}): { subject: string; html: string } {
  const opName = escapeHtml(args.operatorName);
  const uni = escapeHtml(args.universityName);
  const svc = escapeHtml(args.serviceName);
  const ws = escapeHtml(args.writeStart);
  const we = escapeHtml(args.writeEnd);
  const subject = `[진학어플라이] ${args.universityName} ${args.serviceName} 인터넷 원서접수 자료 요청 건`;
  const scheduleLine =
    args.writeStart && args.writeEnd
      ? `<br/><strong>(작년 일정 : ${ws} ~ ${we})</strong>`
      : "";
  const html = `<!DOCTYPE html><html lang="ko"><body style="margin:0;padding:0;">
<div style="font-family:Arial,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#222;font-size:14px;line-height:1.6;max-width:620px;margin:0 auto;">
  <div style="margin-bottom:20px;">
    안녕하세요.<br/>
    진학어플라이 ${opName}입니다.
  </div>
  <div style="margin-bottom:20px;">
    <strong>${uni} ${svc} 인터넷 원서접수 서비스 진행</strong> 관련하여 메일드립니다.${scheduleLine}
  </div>
  <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:3px;padding:16px;margin:20px 0;font-size:13px;">
    <div style="font-weight:600;margin-bottom:8px;">요청 항목</div>
    <ul style="margin:0;padding-left:18px;">
      <li>모집요강</li>
      <li>전산자료(레이아웃, 코드자료 등)</li>
      <li>원서작업에 필요한 추가 자료</li>
    </ul>
  </div>
  <div style="margin-bottom:22px;">
    <strong>원활한 서비스 준비를 위해 최소 2주 전까지 자료 회신 요청드립니다.</strong><br/>
    감사합니다.
  </div>
  <div style="margin-top:30px;text-align:center;font-size:11px;color:#999;border-top:1px solid #eee;padding-top:12px;">
    ※ 본 메일은 인터넷 원서접수 준비를 위해 시스템에서 자동 발송되었습니다.
  </div>
</div>
</body></html>`;
  return { subject, html };
}
