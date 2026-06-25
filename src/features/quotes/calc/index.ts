import type { QuoteSection, QuoteDocument, QuoteTotals } from "../document-schema";

/** 섹션 소계 — kind 'amount' 컬럼들의 행 합. (dev/fee: 'amount' 단일) */
export function sectionSubtotal(section: QuoteSection): number {
  const amountKeys = section.columns
    .filter((c) => c.kind === "amount")
    .map((c) => c.key);
  let sum = 0;
  for (const row of section.rows) {
    for (const k of amountKeys) {
      const v = row[k];
      if (typeof v === "number") sum += v;
    }
  }
  return sum;
}

/** 문서 총계 — Σ섹션소계 = 공급가, 부가세 10%, 합계. vatIncluded면 분리. */
export function quoteTotals(
  document: QuoteDocument,
  opts?: { vatIncluded?: boolean },
): QuoteTotals {
  const vatIncluded = opts?.vatIncluded ?? document.totals.vatIncluded ?? false;
  const subtotalSum = document.sections.reduce(
    (acc, s) => acc + sectionSubtotal(s),
    0,
  );
  if (vatIncluded) {
    const total = subtotalSum;
    const supply = Math.round(total / 1.1);
    return { supply, vat: total - supply, total, vatIncluded: true };
  }
  const supply = subtotalSum;
  const vat = Math.round(supply * 0.1);
  return { supply, vat, total: supply + vat, vatIncluded: false };
}

/** 섹션 소계 + 총계를 재계산한 문서 반환(불변). 저장 시 서버가 호출. */
export function recomputeDocument(document: QuoteDocument): QuoteDocument {
  const sections = document.sections.map((s) => ({
    ...s,
    subtotal: sectionSubtotal(s),
  }));
  const next = { ...document, sections };
  return { ...next, totals: quoteTotals(next) };
}

const KO_DIGITS = ["영", "일", "이", "삼", "사", "오", "육", "칠", "팔", "구"];
const KO_SMALL = ["", "십", "백", "천"];
const KO_BIG = ["", "만", "억", "조", "경"];

/** 4자리 이하 숫자 → 한글 표기 (십/백/천 앞의 "일" 생략). */
function groupToKorean(g: number): string {
  let part = "";
  let gg = g;
  let si = 0;
  while (gg > 0) {
    const d = gg % 10;
    if (d > 0) {
      // 십(si=1) 자리의 "일"만 생략 (일십→십). 백/천은 유지 (일백, 일천).
      const prefix = d === 1 && si === 1 ? "" : KO_DIGITS[d];
      part = prefix + KO_SMALL[si] + part;
    }
    gg = Math.floor(gg / 10);
    si++;
  }
  return part;
}

/** 숫자 → 한글 금액(예: 1100000 → '일백십만'). 0 → '영'. */
export function koreanAmount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "영";
  let v = Math.floor(n);
  const groups: string[] = [];
  let gi = 0;
  while (v > 0) {
    const g = v % 10000;
    if (g > 0) {
      const part = groupToKorean(g);
      groups.unshift(part + KO_BIG[gi]);
    } else {
      groups.unshift("");
    }
    v = Math.floor(v / 10000);
    gi++;
  }
  return groups.join("");
}
