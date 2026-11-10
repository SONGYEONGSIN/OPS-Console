// 표의 [지금 실행] 버튼들이 함께 쓰는 문구·클래스 — 잡마다 모양이 갈리지 않게 한 곳에 둔다.

export const ADMIN_ONLY_MSG = "관리자만 실행 가능합니다.";

// '지금 실행' 버튼 (기존 RunControl 과 같은 문자열)
export const RUN_NOW_CLASS =
  "inline-flex w-fit items-center border border-vermilion bg-vermilion cursor-pointer px-3 py-1 text-xs font-medium text-cream transition-opacity hover:opacity-90 disabled:opacity-50";

// '쿨다운 N분 — 강제 실행' 버튼 (기존 RunControl 과 같은 문자열)
export const RUN_COOLDOWN_CLASS =
  "inline-flex w-fit items-center border border-vermilion bg-transparent cursor-pointer px-3 py-1 text-xs font-medium text-vermilion transition-opacity hover:opacity-90";
