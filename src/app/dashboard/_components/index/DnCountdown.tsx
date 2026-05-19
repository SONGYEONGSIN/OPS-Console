type DnItem = {
  dn: string;
  university: string;
  service: string;
};

/**
 * DnCountdown — 마감 임박 4 도메인 카드.
 * D-3은 vermilion 강조 (가장 긴급), 나머지는 ink 톤.
 */
export function DnCountdown({ items }: { items: DnItem[] }) {
  if (items.length === 0) {
    return (
      <p className="border-l-2 border-sage py-1 pl-3 text-sm text-ink-soft">
        임박 일정 없음 — currently 정상
      </p>
    );
  }

  return (
    <ul
      className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      data-testid="dn-countdown"
    >
      {items.map((it) => {
        const isUrgent = it.dn === "D-3" || it.dn === "D-1" || it.dn === "D-0";
        return (
          <li
            key={`${it.dn}-${it.university}`}
            className={`border bg-cream p-3 ${
              isUrgent ? "border-vermilion" : "border-line"
            }`}
          >
            <p
              className={`font-mono text-lg font-bold ${
                isUrgent ? "text-vermilion" : "text-ink"
              }`}
            >
              {it.dn}
            </p>
            <p className="mt-1 truncate text-sm font-medium text-ink">
              {it.university}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">{it.service}</p>
          </li>
        );
      })}
    </ul>
  );
}
