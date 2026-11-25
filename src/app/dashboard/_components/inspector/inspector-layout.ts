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
 * 보기 모드는 `viewWide` 인 variant 만 wide — 사고보고처럼 긴 글을 쓴 것은
 * 읽을 때도 쓸 때와 같은 폭으로 본다. 나머지는 standard.
 */
export function inspectorLayoutFor(
  variant: Variant,
  editing: boolean,
): InspectorLayout {
  const entry = variantRegistry[variant];
  const wide = editing
    ? "editWide" in entry && entry.editWide
    : "viewWide" in entry && entry.viewWide;
  return wide ? INSPECTOR_LAYOUT.wide : INSPECTOR_LAYOUT.standard;
}
