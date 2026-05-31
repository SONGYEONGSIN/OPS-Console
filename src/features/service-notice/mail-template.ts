import { brandLogoImg } from "@/lib/mail/brand-logo";
import type { ServiceNoticeGroup, ServiceNoticeService } from "./schemas";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const KST_DATE = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return KST_DATE.format(d).replace(/-/g, ".");
}

const CATEGORY_ORDER = ["공통원서", "반응형원서", "공공접수"];

function orderedCategories(services: ServiceNoticeService[]): string[] {
  const present = Array.from(
    new Set(services.map((s) => s.category).filter(Boolean)),
  );
  return [
    ...CATEGORY_ORDER.filter((c) => present.includes(c)),
    ...present.filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
}

/** 메일 제목 — '운영부 상황실' 브랜드 통일. monthLabel = 다음 달(1~12). */
export function buildServiceNoticeSubject(monthLabel: number): string {
  return `[운영부 상황실] 원서접수 일정 확인 알림 (${monthLabel}월)`;
}

function categorySection(
  category: string,
  services: ServiceNoticeService[],
): string {
  const rows = services
    .map(
      (s) => `
      <tr>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(s.universityName)}<span style="color:#9ca3af;font-size:12px;"> · ${escapeHtml(s.universityType)}</span></td>
        <td style="padding:10px;border-bottom:1px solid #eee;">${escapeHtml(s.serviceName)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">${fmtDate(s.writeStartAt)} ~ ${fmtDate(s.writeEndAt)}</td>
        <td style="padding:10px;border-bottom:1px solid #eee;text-align:center;white-space:nowrap;">${fmtDate(s.payStartAt)} ~ ${fmtDate(s.payEndAt)}</td>
      </tr>`,
    )
    .join("");
  return `
    <div style="margin-top:18px;">
      <div style="font-size:14px;font-weight:700;color:#b8331e;margin-bottom:6px;">${escapeHtml(category)} <span style="color:#9ca3af;font-weight:400;">${services.length}건</span></div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;min-width:560px;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <th style="padding:10px;text-align:left;">대학명 · 유형</th>
              <th style="padding:10px;text-align:left;">서비스명</th>
              <th style="padding:10px;text-align:center;">작성 시작 ~ 마감</th>
              <th style="padding:10px;text-align:center;">결제 시작 ~ 마감</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>`;
}

/**
 * 운영자 본인용 월별 서비스 알림 메일 HTML.
 * 다음 달 작성시작 서비스를 카테고리별 표로. 브랜드는 '운영부 상황실' + 시스템 로고.
 */
export function buildServiceNoticeHtml(
  group: ServiceNoticeGroup,
  monthLabel: number,
): string {
  const operatorName = escapeHtml(group.operator.name);
  const sections = orderedCategories(group.services)
    .map((cat) =>
      categorySection(
        cat,
        group.services.filter((s) => s.category === cat),
      ),
    )
    .join("");

  return `
  <div style="font-family:Pretendard,Apple SD Gothic Neo,Noto Sans KR,Malgun Gothic,Arial,sans-serif;color:#222;background:#fff;padding:24px;">
    <div style="text-align:center;margin-bottom:12px;">${brandLogoImg(46)}</div>
    <div style="font-size:22px;font-weight:700;text-align:center;margin-bottom:22px;background:#111827;color:#fff;padding:16px 0;border-radius:3px;">
      [운영부 상황실] 원서접수 일정 확인 알림 (${monthLabel}월)
    </div>

    <div style="font-size:15px;margin-bottom:4px;line-height:1.5;color:#374151;">
      안녕하세요. ${operatorName}님,<br/>
      다음 달(${monthLabel}월)에 작성이 시작되는 본인 담당 서비스 일정입니다. 미리 준비해 주세요.
    </div>

    ${sections}

    <div style="margin-top:22px;text-align:center;font-size:12px;color:#111;background:#FEF9C3;padding:8px 0;border-radius:3px;">
      ※ 본 알림 메일은 운영부 상황실에서 자동 발송되었습니다.
    </div>
  </div>`;
}
