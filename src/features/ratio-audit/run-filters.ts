// 경쟁률 점검 실행 조건 — 대학구분·모집구분 판정 규칙(순수, 클라이언트에서도 import).
// 정시 뒤의 말(가나다·나다·가다·나·다)은 같은 모집의 군이라 '정시'로 시작하면 모두 정시다.
// 수시 뒤의 '재외국민'은 서비스·경쟁률 세팅이 따로 있는 별도 전형이라 정확히 '수시'만 수시다.
import { z } from "zod";

export const RATIO_UNIV_OPTIONS = ["4년제", "2년제"] as const;
export const RATIO_RECRUIT_OPTIONS = ["수시", "정시"] as const;
export type RatioUniv = (typeof RATIO_UNIV_OPTIONS)[number];
export type RatioRecruit = (typeof RATIO_RECRUIT_OPTIONS)[number];

// 화면 라벨 → closing_services.university_type 실값(2년제 = 전문대·폴리텍·전공대학 총칭)
export const UNIV_TYPE_VALUES: Readonly<Record<RatioUniv, readonly string[]>> = {
  "4년제": ["4년제"],
  "2년제": ["2년제", "전문대"],
};

export const RATIO_PERIOD_LABEL = "접수 마감 전";

export const RATIO_RUN_NEEDS_CONDITIONS =
  "실행 조건(대학구분·모집구분)을 골라야 합니다 — 자동화 페이지의 [지금 실행]에서 조건 창으로 실행하세요.";

// 중복을 없애고 화면 순서로 맞춘다
function normalizeOrder<T extends string>(options: readonly T[], picked: readonly T[]): T[] {
  return options.filter((option) => picked.includes(option));
}

// 최상위 transform 금지 — 다른 태스크가 .extend 로 확장한다(필드 단위 transform 만 쓴다)
export const ratioAuditFiltersSchema = z.object({
  univ: z
    .array(z.enum(RATIO_UNIV_OPTIONS, { error: "대학구분 값이 올바르지 않습니다." }))
    .min(1, "대학구분을 하나 이상 고르세요.")
    .transform((picked) => normalizeOrder(RATIO_UNIV_OPTIONS, picked)),
  recruit: z
    .array(z.enum(RATIO_RECRUIT_OPTIONS, { error: "모집구분 값이 올바르지 않습니다." }))
    .min(1, "모집구분을 하나 이상 고르세요.")
    .transform((picked) => normalizeOrder(RATIO_RECRUIT_OPTIONS, picked)),
});

export type RatioAuditFilters = { univ: RatioUniv[]; recruit: RatioRecruit[] };

function matchesUniv(universityType: string | null, univ: readonly RatioUniv[]): boolean {
  if (universityType === null) return false;
  const value = universityType.trim();
  return univ.some((option) => UNIV_TYPE_VALUES[option].includes(value));
}

function matchesRecruit(category: string | null, recruit: readonly RatioRecruit[]): boolean {
  if (category === null) return false;
  const value = category.trim();
  return recruit.some((option) =>
    option === "수시" ? value === "수시" : value.startsWith("정시"),
  );
}

// 두 묶음 모두 맞아야 대상이다(교집합). null 은 어느 쪽에도 안 든다.
export function matchesRatioAuditFilters(
  row: { university_type: string | null; category: string | null },
  f: RatioAuditFilters,
): boolean {
  return matchesUniv(row.university_type, f.univ) && matchesRecruit(row.category, f.recruit);
}

// 예: "4년제, 2년제 · 수시 · 접수 마감 전"
export function ratioFilterLabel(f: RatioAuditFilters): string {
  return [f.univ.join(", "), f.recruit.join(", "), RATIO_PERIOD_LABEL].join(" · ");
}

// 예: "조건: 2년제 · 수시 · 접수 마감 전 — 대상 12건"
export function conditionLine(f: RatioAuditFilters, targetCount: number): string {
  return `조건: ${ratioFilterLabel(f)} — 대상 ${targetCount}건`;
}
