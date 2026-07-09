/**
 * 백업 요청서 HTML 문서 (메일 첨부용). 인수인계 확인서 HTML 레이아웃 참고 —
 * band 헤더 + meta + 서비스 섹션. 라이브러리 없이 문자열로 생성. XSS: 전 필드 escape.
 */

export type BackupHtmlContact = {
  contact_id: string;
  customer_name: string;
  university_name: string;
  email: string | null;
  phone: string | null;
  ext?: string | null;
};

export type BackupHtmlService = {
  id: string;
  service_id: number;
  service_name: string;
  university_name: string;
  contacts: BackupHtmlContact[];
  note_md: string | null;
};

export type BackupRequestHtmlInput = {
  requesterName: string;
  requesterEmail: string;
  substituteName: string;
  substituteEmail: string;
  leaveStartDate: string | null;
  leaveEndDate: string | null;
  services: BackupHtmlService[];
  summaryMd: string;
  createdAt: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 개행 보존 텍스트 (escape 후 pre-wrap). */
function textHtml(s: string): string {
  return escapeHtml(s);
}

function formatYmd(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function leavePeriod(start: string | null, end: string | null): string {
  if (start && end) return `${start} ~ ${end}`;
  if (start) return `${start} ~`;
  if (end) return `~ ${end}`;
  return "—";
}

function person(name: string, email: string): string {
  return `<span class="pri">${escapeHtml(name)}</span><span class="dim"> · ${escapeHtml(email)}</span>`;
}

function serviceSection(services: BackupHtmlService[]): string {
  if (services.length === 0) {
    return `<p class="empty">인계 대상 서비스가 없습니다.</p>`;
  }
  return services
    .map((s) => {
      const contacts =
        s.contacts.length > 0
          ? s.contacts
              .map((c) => {
                const meta = [c.email, c.phone, c.ext ? `내선 ${c.ext}` : null]
                  .filter(Boolean)
                  .map((x) => escapeHtml(String(x)))
                  .join(" · ");
                return `<div class="pplline">${escapeHtml(c.customer_name)}<span class="ppldim">${meta ? ` · ${meta}` : ""}</span></div>`;
              })
              .join("")
          : `<div class="empty">연락처 없음</div>`;
      const note = s.note_md?.trim()
        ? `<div class="memoline">${textHtml(s.note_md)}</div>`
        : "";
      return `<div class="svc">
        <div class="svchead">${escapeHtml(s.university_name)} — ${escapeHtml(s.service_name)} <span class="svcid">(${s.service_id})</span></div>
        <div class="svcbody">${contacts}${note}</div>
      </div>`;
    })
    .join("");
}

export function buildBackupRequestHtmlDocument(
  input: BackupRequestHtmlInput,
): string {
  const summary = input.summaryMd.trim()
    ? `<div class="sec">
        <div class="sechead"><span class="sectitle">요약</span></div>
        <div class="valline">${textHtml(input.summaryMd)}</div>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>백업 요청서 — ${escapeHtml(input.substituteName)}</title>
<style>
  :root{
    --vermilion:#b8331e; --ink:#1a1712; --muted:#8a8175; --faint:#b8b0a2;
    --washi-raised:#f4eddd; --paper:#fbf7f0; --line:#e2dac9;
  }
  *{box-sizing:border-box;}
  body{margin:0;background:#f2efe8;color:var(--ink);
    font-family:'Pretendard',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    -webkit-font-smoothing:antialiased;line-height:1.6;}
  .sheet{max-width:900px;margin:24px auto;background:#fff;
    box-shadow:0 6px 28px rgba(0,0,0,.18);overflow:hidden;}
  .band{background:var(--vermilion);color:#fff;padding:26px 34px 22px;}
  .brand{font-size:11px;letter-spacing:.24em;opacity:.9;margin-bottom:10px;}
  .btitle{font-size:26px;font-weight:800;letter-spacing:-.01em;}
  .bsub{font-size:13px;opacity:.92;margin-top:7px;}
  .meta{background:#e0e0e5;padding:16px 34px;display:flex;
    justify-content:space-between;align-items:center;gap:24px;flex-wrap:wrap;}
  .metacol{display:grid;grid-template-columns:56px auto;gap:6px 14px;align-items:baseline;}
  .metacol b{color:#43434a;font-weight:600;font-size:12px;}
  .metacol span{font-size:12px;color:#1f1f24;}
  .metacol .pri{font-weight:700;color:#1f1f24;}
  .metacol .dim{font-weight:400;color:#6b6b72;}
  .main{padding:24px 34px;}
  .sec{margin-bottom:22px;}
  .sechead{display:flex;justify-content:space-between;align-items:flex-end;
    border-bottom:2.5px solid var(--vermilion);padding-bottom:5px;margin-bottom:10px;}
  .sectitle{font-size:15px;font-weight:800;color:var(--vermilion);}
  .seccount{font-size:11px;color:var(--muted);font-weight:600;}
  .svc{padding:10px 0;}
  .svc + .svc{border-top:1px solid var(--washi-raised);}
  .svchead{font-size:13px;font-weight:700;color:var(--ink);}
  .svcid{color:var(--faint);font-weight:400;}
  .svcbody{margin-top:5px;font-size:12px;}
  .pplline{padding:1px 0;}
  .ppldim{color:var(--muted);}
  .valline{white-space:pre-wrap;font-size:13px;}
  .memoline{color:var(--muted);margin-top:3px;white-space:pre-wrap;}
  .empty{color:var(--faint);font-size:12px;}
  .foot{padding:14px 34px;border-top:2px solid var(--vermilion);color:var(--muted);font-size:11px;}
  @media print{body{background:#fff;}.sheet{box-shadow:none;margin:0;max-width:none;}}
</style>
</head>
<body>
  <div class="sheet">
    <div class="band">
      <div class="brand">운영부 상황실 · 백업 요청</div>
      <div class="btitle">백업 요청서</div>
      <div class="bsub">${escapeHtml(input.requesterName)} → ${escapeHtml(input.substituteName)}</div>
    </div>

    <div class="meta">
      <div class="metacol">
        <b>요청자</b><span>${person(input.requesterName, input.requesterEmail)}</span>
        <b>백업자</b><span>${person(input.substituteName, input.substituteEmail)}</span>
      </div>
      <div class="metacol">
        <b>휴가기간</b><span>${escapeHtml(leavePeriod(input.leaveStartDate, input.leaveEndDate))}</span>
        <b>요청일</b><span>${escapeHtml(formatYmd(input.createdAt))}</span>
      </div>
    </div>

    <div class="main">
      ${summary}
      <div class="sec">
        <div class="sechead">
          <span class="sectitle">백업 서비스</span>
          <span class="seccount">${input.services.length}건</span>
        </div>
        ${serviceSection(input.services)}
      </div>
    </div>

    <div class="foot">운영부 상황실 자동발송 · 백업 기간 동안 위 서비스를 대신 담당해 주세요.</div>
  </div>
</body>
</html>`;
}
