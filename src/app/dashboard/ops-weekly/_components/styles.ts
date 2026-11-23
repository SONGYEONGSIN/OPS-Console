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
// 표 제목 줄 고정 — lg 이상에서 KPI 바(--ops-kpi-h) + 영역 탭 줄(--ops-area-h) 바로 아래에 붙는다.
// 일회성 임의 값: 두 높이는 각 막대가 ResizeObserver 로 재서 CSS 변수로 알린다.
export const STICKY_TITLE_CLASS =
  "bg-paper lg:sticky lg:top-[calc(var(--ops-kpi-h,0px)+var(--ops-area-h,0px))] lg:z-10";
/** 표 제목 줄 높이 — 그 아래 표 머리줄 고정 자리가 읽는다(useHeightVar 로 잰다). */
export const TITLE_HEIGHT_VAR = "--ops-title-h";
// 표 머리줄 고정 — 표 제목 줄 바로 아래. 표가 border-collapse 라 머리줄 밑줄은 붙은 동안 따라오지 않아
// 안쪽 그림자로 다시 긋는다. 감싸는 상자의 가로 스크롤(overflow-x-auto)은 lg 에서 풀어야 붙는다(TABLE_SCROLL_CLASS).
export const STICKY_THEAD_CLASS =
  "bg-paper lg:sticky lg:top-[calc(var(--ops-kpi-h,0px)+var(--ops-area-h,0px)+var(--ops-title-h,0px))] lg:z-[5] lg:shadow-[inset_0_-1px_0_var(--color-line)]";
// 좁은 화면은 표를 가로로 밀고, lg 이상은 풀어 둔다 — 가로 스크롤 상자는 sticky 를 그 안에 가둔다.
export const TABLE_SCROLL_CLASS = "overflow-x-auto lg:overflow-visible";
