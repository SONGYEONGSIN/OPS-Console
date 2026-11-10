import { variantRegistry } from "./list-variants/registry";
import type { Variant } from "./list-variants/types";

/**
 * 인스펙터 폭과 목록 여백 — 한 쌍으로 묶어 둔다.
 * 여백은 폭 + 20px(가장자리 간격). 둘이 따로 놀면 넓어진 패널이 목록을 덮는다.
 * Tailwind 가 클래스를 찾을 수 있도록 리터럴 그대로 적는다.
 */
export const INSPECTOR_LAYOUT = {
  standard: { panel: "md:w-[320px]", gutter: "md:pr-[340px]" },
  wide: { panel: "md:w-[560px]", gutter: "md:pr-[580px]" },
} as const;

export type InspectorLayout =
  (typeof INSPECTOR_LAYOUT)[keyof typeof INSPECTOR_LAYOUT];

/**
 * variant 가 편집 중에 넓은 폭을 원하면(`editWide`) wide, 아니면 standard.
 * 보기 모드는 항상 standard — 넓히는 건 긴 글을 쓰는 순간뿐이다.
 */
export function inspectorLayoutFor(
  variant: Variant,
  editing: boolean,
): InspectorLayout {
  if (!editing) return INSPECTOR_LAYOUT.standard;
  const entry = variantRegistry[variant];
  return "editWide" in entry && entry.editWide
    ? INSPECTOR_LAYOUT.wide
    : INSPECTOR_LAYOUT.standard;
}
