"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** input의 aria-label (default "검색"). EditForm 등 컨텍스트별 override */
  ariaLabel?: string;
  /**
   * 사이즈 variant:
   * - default: 목록 페이지 (py-2 + bg-washi-raised + border-line-soft)
   * - sm: EditForm 내 (py-1 + bg-cream + border-line — 다른 input과 시각 통일)
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
  const containerClass =
    size === "sm"
      ? "flex w-full items-center gap-1.5 border border-line bg-cream px-2 py-1"
      : "flex flex-1 min-w-[240px] items-center gap-1.5 border border-line-soft bg-washi-raised px-3 py-2";
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
