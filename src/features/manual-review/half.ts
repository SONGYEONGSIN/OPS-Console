import { kstFormat } from "@/lib/kst-format";

/** 반기 점검 회차. 8월 = 그해 4~9월(H1), 3월 = 전년 10월~그해 3월(H2). */
export type ReviewHalf = { key: string; label: string; month: 3 | 8 };

const KST_YEAR_MONTH = kstFormat({ year: "numeric", month: "numeric" });

function kstYearMonth(now: Date): { year: number; month: number } {
  const parts = KST_YEAR_MONTH.formatToParts(now);
  const num = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return { year: num("year"), month: num("month") };
}

/** 오늘(KST)이 알림 달이면 그 회차, 아니면 null. 날짜 계산은 여기 한 곳에서만 한다. */
export function reviewHalfFor(now: Date): ReviewHalf | null {
  const { year, month } = kstYearMonth(now);
  if (month === 8)
    return { key: `${year}-H1`, label: "1·2분기(4~9월)", month: 8 };
  if (month === 3) {
    return { key: `${year - 1}-H2`, label: "3·4분기(10~3월)", month: 3 };
  }
  return null;
}
