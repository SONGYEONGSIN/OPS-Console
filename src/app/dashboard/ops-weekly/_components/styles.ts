export const FIELD_CLASS =
  "border border-line-soft bg-field-bg px-2 py-1 text-sm text-ink focus:border-ink focus:bg-white focus:outline-none";
export const BTN_CLASS =
  "border border-line-soft px-2 py-1 text-xs text-ink hover:border-ink hover:bg-ink hover:text-cream disabled:opacity-50";
// 행 끝 액션 — 터치(lg 미만)에서는 36px 높이를 보장한다.
export const ROW_BTN_CLASS = `${BTN_CLASS} min-h-9 lg:min-h-0`;
// lg 이상 + 고정밀 포인터(마우스)에서만 호버·포커스 때 드러난다. 터치(태블릿 가로 포함)는 호버가 없어 늘 보인다.
export const ROW_REVEAL_CLASS =
  "transition-opacity lg:pointer-fine:opacity-0 lg:pointer-fine:group-hover:opacity-100 lg:pointer-fine:group-focus-within:opacity-100";
export const BADGE_CLASS =
  "border border-line-soft px-1.5 py-0.5 text-xs text-muted";
export const ERROR_CLASS = "text-xs text-vermilion";
