export type BadgeDomain =
  | "사고"
  | "할일"
  | "서비스"
  | "백업"
  | "일정"
  | "인수인계"
  | "계약"
  | "공지"
  | "미수채권";

const COLOR: Record<BadgeDomain, string> = {
  사고: "border-vermilion text-vermilion",
  할일: "border-ink text-ink",
  서비스: "border-ink-muted text-ink-muted",
  백업: "border-indigo text-indigo",
  일정: "border-amber text-amber",
  인수인계: "border-gold text-gold",
  계약: "border-sage text-sage",
  공지: "border-vermilion-deep text-vermilion-deep",
  미수채권: "border-green-light text-green-light",
};

type Props = { domain: BadgeDomain };

/** 도메인 식별 badge. 9색 변종. */
export function DomainBadge({ domain }: Props) {
  return (
    <span className={`inline-block min-w-[54px] border px-1.5 py-0.5 text-center text-[11px] font-bold ${COLOR[domain]}`}>
      {domain}
    </span>
  );
}
