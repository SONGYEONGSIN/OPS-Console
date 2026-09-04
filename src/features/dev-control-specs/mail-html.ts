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
 * 학교 담당자에게 보내는 **안내 메일 본문** — 내용은 첨부 문서에 있다.
 *
 * 항목을 본문에 다 실었더니 실측 68항목이 23,734자였다(2026-09-04). 메일에서
 * 스크롤로 읽을 분량이 아니고, 학교가 내부 회람하려면 파일이 편하다.
 * 그래서 본문은 **무엇이 왔는지 알려주는 몇 줄**만 둔다.
 *
 * 첨부를 언급하지 않으면 빈 메일처럼 보이므로 반드시 적는다.
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

  const head = args.serviceName
    ? `${esc(args.universityName)} ${esc(args.serviceName)}`
    : esc(args.universityName);

  return [
    `<div style="font-family:'Malgun Gothic','맑은 고딕',sans-serif;max-width:640px;color:#1a1a1a">`,
    `<p style="font-size:15px;line-height:1.8">안녕하세요, ${BRAND}입니다.</p>`,
    `<p style="font-size:15px;line-height:1.8">${head} 원서접수에 현재 적용되어 있는 제어를 정리해 첨부드립니다.</p>`,
    `<p style="font-size:15px;line-height:1.8"><b>첨부 문서</b>에 총 <b>${included.length}건</b>이 담겨 있습니다. 지원자가 실제로 겪는 내용을 기준으로 적었습니다.</p>`,
    collected
      ? `<p style="margin-top:18px;font-size:13px;color:#777">※ ${collected} 기준으로 확인한 내용입니다.</p>`
      : "",
    `<p style="margin-top:6px;font-size:13px;color:#777">※ 변경이 필요하시면 담당 운영자에게 회신해 주세요.</p>`,
    `</div>`,
  ].join("");
}
