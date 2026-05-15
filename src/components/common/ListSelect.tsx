"use client";

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
  /** 빈 옵션 라벨 (예: "대학구분 전체"). 미지정 시 빈 옵션 미노출 */
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * 목록 페이지 필터 select — 모든 list 도메인 공통.
 *
 * 디자인: SettingsPattern select와 동일 — border + bg-transparent + px-3 py-2 +
 * focus:border-vermilion. options는 string[] (value === label).
 *
 * 사용 예 (services / contracts / 향후 도메인 동일):
 *   <ListSelect
 *     value={universityType}
 *     onChange={(v) => navigate({ universityType: v || null })}
 *     options={UNIVERSITY_TYPE_OPTIONS}
 *     placeholder="대학구분 전체"
 *     ariaLabel="대학구분 필터"
 *   />
 */
export function ListSelect({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  className,
}: Props) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`border border-line bg-transparent px-3 py-2 text-sm text-ink outline-none focus:border-vermilion ${className ?? ""}`}
    >
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
