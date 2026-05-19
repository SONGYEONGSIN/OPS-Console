type Tone = "neutral" | "urgent";

type Props = {
  kicker: string;
  primary: string;
  title: string;
  subtitle: string;
  tone?: Tone;
};

const PRIMARY_COLOR: Record<Tone, string> = {
  neutral: "text-ink",
  urgent: "text-vermilion",
};

/**
 * HeroCard — Apple Stocks 톤의 큰 위젯.
 * 좌상단 kicker (작은 라벨) / 중앙 큰 primary 수치 / 하단 title + subtitle.
 * tone=urgent 시 primary가 vermilion으로 강조 (D-3 / 미수 등 임박 신호).
 */
export function HeroCard({ kicker, primary, title, subtitle, tone = "neutral" }: Props) {
  return (
    <article className="flex h-full flex-col border border-line bg-cream p-6">
      <p className="text-2xs uppercase tracking-[0.18em] text-muted">
        {kicker}
      </p>
      <p
        className={`mt-3 font-mono text-5xl font-bold tracking-tight ${PRIMARY_COLOR[tone]}`}
      >
        {primary}
      </p>
      <p className="mt-auto pt-4 text-base font-semibold text-ink">{title}</p>
      <p className="text-xs text-muted">{subtitle}</p>
    </article>
  );
}
