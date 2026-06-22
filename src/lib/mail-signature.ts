/**
 * 메일함 회신 HTML 서명 + 본문 HTML 변환.
 *
 * 발신 명의(메일함 주인)의 운영자 정보로 클릭 가능한 링크 서명을 만든다.
 * 동적 값(name/department/team/role/phone)은 모두 htmlEscape하여 주입을 방지한다.
 */

export type OperatorSig = {
  name?: string | null;
  department?: string | null;
  team?: string | null;
  role?: string | null;
  phone?: string | null;
};

/** & < > " ' 를 HTML 엔티티로 이스케이프. & 를 먼저 처리해 이중 이스케이프 방지. */
export function htmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 본문(plain) → HTML. 이스케이프 후 줄바꿈을 <br> 로 변환. */
export function htmlifyBody(plain: string): string {
  return htmlEscape(plain).replace(/\n/g, "<br>");
}

const COMPANY = "(주)진학어플라이";
const ADDRESS = "서울특별시 종로구 경희궁길 34 (진학기획B/D 3F)";
const FAX = "02-730-0517";
const LINKS: ReadonlyArray<{ url: string; label: string }> = [
  { url: "https://www.jinhakapply.com/", label: "원서접수" },
  { url: "https://www.jinhak.com/", label: "진학닷컴" },
  { url: "https://www.catch.co.kr/", label: "CATCH" },
  { url: "https://www.jinhakpro.com/", label: "JINHAKPRO(전임·강사·연구원채용)" },
];

/** 운영자 정보로 HTML 서명 문자열 생성. 각 줄 <br> 구분. */
export function buildHtmlSignature(op: OperatorSig): string {
  const department = op.department ? htmlEscape(op.department) : "";
  const team = op.team ? htmlEscape(op.team) : "";
  const role = op.role ? htmlEscape(op.role) : "";
  const name = op.name ? htmlEscape(op.name) : "";
  const phone = op.phone ? htmlEscape(op.phone) : "";

  // 첫 줄: 회사명 + 공백 2칸 + 부서 팀 (| 역할)
  const orgParts = [department, team].filter(Boolean).join(" ");
  const firstLine =
    `${COMPANY}&nbsp;&nbsp;${orgParts}` + (role ? ` | ${role}` : "");

  const phonePart = phone ? `T. ${phone} | ` : "";
  const contactLine = `${phonePart}F. ${FAX}`;

  const linkLine = LINKS.map(
    (l) => `<a href="${l.url}">${l.label}</a>`,
  ).join(" | ");

  const lines = [firstLine];
  if (name) lines.push(name);
  lines.push(ADDRESS, contactLine, linkLine);

  return lines.join("<br>");
}

/** 편집된 본문(plain) + 서명을 div 로 래핑한 회신 HTML. */
export function buildReplyHtml(editedBody: string, op: OperatorSig): string {
  return `<div>${htmlifyBody(editedBody)}<br><br>${buildHtmlSignature(op)}</div>`;
}
