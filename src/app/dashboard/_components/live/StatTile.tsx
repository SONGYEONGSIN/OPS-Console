import Link from "next/link";

type Props = {
  label: string;
  value: number | string;
  sub: string;
  href?: string;
};

/**
 * StatTile — Apple Health 톤의 작은 위젯.
 * 도메인 카운트 박스. href 있으면 해당 메뉴로 이동.
 */
export function StatTile({ label, value, sub, href }: Props) {
  const body = (
    <article className="flex h-full flex-col border border-line bg-cream px-4 py-3 transition-colors hover:border-vermilion">
      <p className="text-2xs uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-2 font-mono text-2xl font-bold text-ink">{value}</p>
      <p className="mt-auto pt-1 text-2xs text-muted">{sub}</p>
    </article>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {body}
      </Link>
    );
  }
  return body;
}
