import { kstFormat } from "@/lib/kst-format";
import type { DevControlSpecItem } from "./schemas";

export type SpecMailArgs = {
  universityName: string;
  serviceName?: string | null;
  items: DevControlSpecItem[];
  /** 코드를 걷어 온 시각. 없으면 문서에 적지 않는다. */
  sourceAnalyzedAt?: string | null;
};

/** 사내 메일 브랜드 — 제목·본문·첨부 모두 이것 하나로 통일한다. */
const BRAND = "[운영부 상황실]";

/**
 * HTML 이스케이프.
 *
 * **항목 문구는 모델이 쓴 것이다** — 코드에서 뽑아낸 문장이 그대로 들어오므로
 * `<`, `&` 가 섞이면 본문이 깨지거나 태그로 해석된다.
 */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSpecSubject(args: SpecMailArgs): string {
  const tail = args.serviceName ? ` ${args.serviceName}` : "";
  return `${BRAND} ${args.universityName}${tail} 원서접수 제어 안내`;
}

/**
 * 학교 담당자에게 보내는 명세 본문.
 *
 * **`buildReplyHtml` 을 쓰지 않는다** — 그쪽은 `\n`→`<br>` 만 해서 연속 공백이
 * 접히고, 에디터에서는 멀쩡한데 받은 편지함에서만 정렬이 무너진다(오픈안내에서 겪었다).
 * 여기서는 항목을 블록으로 쌓으므로 그 문제가 아예 안 생긴다.
 *
 * `included` 가 꺼진 항목은 **여기서 걸러진다.** 화면에는 남지만 메일에는 안 나간다 —
 * 학교로 나간 메일은 되돌릴 수 없어서, 거르는 자리를 한 곳으로 모은다.
 */
export function buildSpecMailHtml(args: SpecMailArgs): string {
  const included = args.items.filter((i) => i.included);
  if (included.length === 0) {
    throw new Error(
      "보낼 항목이 없습니다 — 최소 한 개는 포함해야 발송할 수 있습니다.",
    );
  }

  const collected = args.sourceAnalyzedAt
    ? kstFormat({ year: "numeric", month: "2-digit", day: "2-digit" }).format(
        new Date(args.sourceAnalyzedAt),
      )
    : null;

  const rows = included
    .map(
      (item, idx) =>
        `<tr><td style="padding:14px 0;border-bottom:1px solid #eee;vertical-align:top">` +
        `<div style="font-weight:700;font-size:15px;color:#1a1a1a">${idx + 1}. ${esc(item.title)}</div>` +
        `<div style="margin-top:6px;font-size:14px;line-height:1.75;color:#444">${esc(item.body)}</div>` +
        `</td></tr>`,
    )
    .join("");

  const head = args.serviceName
    ? `${esc(args.universityName)} ${esc(args.serviceName)}`
    : esc(args.universityName);

  return [
    `<div style="font-family:'Malgun Gothic','맑은 고딕',sans-serif;max-width:640px;color:#1a1a1a">`,
    `<p style="font-size:15px;line-height:1.8">안녕하세요, ${BRAND}입니다.</p>`,
    `<p style="font-size:15px;line-height:1.8">${head} 원서접수에 현재 적용되어 있는 제어를 안내드립니다.</p>`,
    `<table style="width:100%;border-collapse:collapse;margin-top:18px">${rows}</table>`,
    collected
      ? `<p style="margin-top:20px;font-size:13px;color:#777">※ ${collected} 기준으로 확인한 내용입니다.</p>`
      : "",
    `<p style="margin-top:6px;font-size:13px;color:#777">※ 변경이 필요하시면 담당 운영자에게 회신해 주세요.</p>`,
    `</div>`,
  ].join("");
}
