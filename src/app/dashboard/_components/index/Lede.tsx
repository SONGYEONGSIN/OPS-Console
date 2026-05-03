import type { DashboardHeadline } from "../../_data/patterns";

/**
 * Lede — 신문 1면의 헤드라인. 입실자가 첫 3초에 읽을 핵심 사건들.
 * 좌측 vermilion accent line + kicker + 사건별 줄 분리 (입실 가독성).
 */
export function Lede({ headline }: { headline: DashboardHeadline }) {
  return (
    <section className="mb-6 border-l-4 border-vermilion pl-4">
      <p className="mb-2 text-2xs uppercase tracking-[0.22em] text-vermilion">
        현재 긴급 · {headline.urgentCount}건
      </p>
      <ul className="flex flex-col gap-1.5">
        {headline.lede.map((line, i) => (
          <li
            key={i}
            className="text-xl leading-[1.4] tracking-[-0.02em] text-ink"
          >
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
