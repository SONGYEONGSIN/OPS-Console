/**
 * SectionLabel — 섹션 kicker + 제목 (신문 1면 톤).
 * 카드 그리드 대신 typographic kicker + 제목으로 zone 구분.
 */
export function SectionLabel({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-3 border-b border-line-soft pb-2">
      <span
        data-testid="section-kicker"
        className="font-mono text-2xs uppercase tracking-[0.22em] text-vermilion"
      >
        {kicker}
      </span>
      <h2 className="text-md font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
    </div>
  );
}
