"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** input의 aria-label (default "검색"). EditForm 등 컨텍스트별 override */
  ariaLabel?: string;
  /**
   * 사이즈 variant:
   * - default: 목록 페이지 (py-2 + bg-search-field-bg + border-line-soft)
   * - sm: EditForm 내 (py-1 — 배경·보더는 default와 동일 검색창 표준)
   */
  size?: "default" | "sm";
  /** container에 추가할 className (예: max-width 제한) */
  className?: string;
};

/**
 * 목록 페이지 검색 input — 모든 list 도메인 공통.
 *
 * 디자인: LogPattern의 검색 input과 동일 — 돋보기 SVG icon + border + bg-washi-raised
 * container. controlled input — 부모가 debounce/SSR push 처리.
 *
 * 사용 예 (services / contracts / 향후 도메인 동일):
 *   <ListSearch value={q} onChange={setQ} placeholder="대학명·서비스명 검색" />
 */
export function ListSearch({
  value,
  onChange,
  placeholder = "쿼리 입력…",
  ariaLabel = "검색",
  size = "default",
  className,
}: Props) {
  // 기본 배경 토큰(bg-search-field-bg) → 포커스 시 흰 배경 + 진한 보더(border-ink, 1px)
  const focusClass =
    "transition-colors focus-within:border-ink focus-within:bg-white";
  const containerClass =
    size === "sm"
      ? `flex w-full items-center gap-1.5 border border-line-soft bg-search-field-bg px-2 py-1 ${focusClass}`
      : `flex flex-1 min-w-[240px] items-center gap-1.5 border border-line-soft bg-search-field-bg px-3 py-2 ${focusClass}`;
  return (
    <div className={`${containerClass} ${className ?? ""}`}>
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-muted">
        <path
          d="M11 6.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0zM10.5 10l3 3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
      </svg>
      <input
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 border-none bg-transparent text-sm text-ink outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:appearance-none"
      />
    </div>
  );
}
