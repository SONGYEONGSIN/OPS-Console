import type { DashboardActivity } from "../../_data/patterns";

/**
 * ActivityColumn — 신문 우측 칼럼의 "최근 활동" feed.
 * mono 시각 + Pretendard 본문 + 이름은 살짝 강조 — 카드 그리드가 아니라
 * 신문 활자 흐름. 위에서 아래로 시간이 흐르며 "지금" 가까운 항목이 위.
 */
export function ActivityColumn({ items }: { items: DashboardActivity[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">활동 없음 — 시프트 시작 직후입니다.</p>
    );
  }

  return (
    <ul className="flex flex-col divide-y divide-line-soft">
      {items.map((a, i) => (
        <li
          key={`${a.time}-${a.who}-${i}`}
          className="grid grid-cols-[44px_1fr] gap-3 py-2"
        >
          <span className="font-mono text-2xs tracking-tight text-vermilion">
            {a.time}
          </span>
          <p className="text-sm leading-snug text-ink">
            <span className="font-semibold text-ink">{a.who}</span>
            <span className="mx-1.5 text-faint">·</span>
            <span className="text-ink-soft">{a.act}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
