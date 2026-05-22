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

export function renderDataRequestHtml(args: {
  subject: string;
  body: string;
  universityName: string;
  serviceName?: string | null;
}): string {
  const { subject, body, universityName, serviceName } = args;
  const safeBody = nl2br(escapeHtml(body));
  const svcLine = serviceName
    ? `${escapeHtml(universityName)} · ${escapeHtml(serviceName)}`
    : escapeHtml(universityName);
  return `<!DOCTYPE html><html lang="ko"><body style="margin:0;padding:0;font-family:'Apple SD Gothic Neo','Malgun Gothic',sans-serif;color:#1a1a1a;line-height:1.7;">
<div style="max-width:640px;margin:0 auto;padding:24px;">
  <div style="border-bottom:2px solid #c0392b;padding-bottom:12px;margin-bottom:20px;">
    <div style="font-size:13px;letter-spacing:0.04em;color:#c0392b;font-weight:700;">[운영부 상황실]</div>
    <div style="font-size:18px;font-weight:700;margin-top:6px;">${escapeHtml(subject)}</div>
    <div style="font-size:13px;color:#666;margin-top:4px;">${svcLine}</div>
  </div>
  <div style="font-size:14px;">${safeBody}</div>
  <div style="border-top:1px solid #ddd;margin-top:28px;padding-top:12px;font-size:11px;color:#999;">
    본 메일은 운영부 상황실에서 발송되었습니다.
  </div>
</div>
</body></html>`;
}
