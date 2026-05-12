import type { ListRow } from "../../../patterns/ListPattern";
import { Section, DefList, Divider } from "../shared";
import { postStatusLabel } from "./Table";

const STATUS_BADGE: Record<ListRow["status"], string> = {
  urgent: "bg-vermilion text-cream",
  active: "bg-sage/20 text-sage",
  review: "bg-gold/20 text-gold",
  approved: "bg-line-soft text-muted",
  inactive: "bg-gold/20 text-gold",
  suspended: "bg-vermilion/20 text-vermilion",
  deleted: "bg-ink/20 text-ink-soft",
};

export function PostView({
  row,
  variant,
}: {
  row: ListRow;
  variant: "post-feedback" | "post-notice";
}) {
  const statusLabel = postStatusLabel(variant, row.status);
  const statusColor = STATUS_BADGE[row.status];

  return (
    <div className="space-y-6">
      <Section title="게시글 정보">
        <DefList
          items={[
            {
              term: "글번호",
              desc: (
                <span className="font-mono">{row.slug ?? (row.id || "-")}</span>
              ),
            },
            { term: "등록자", desc: row.author || "-" },
            { term: "작성일", desc: row.meta ?? "-" },
            {
              term: "상태",
              desc: (
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${statusColor}`}
                >
                  {statusLabel}
                </span>
              ),
            },
          ]}
        />
      </Section>

      <Divider />

      <Section title="본문">
        {row.body ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.body}
          </p>
        ) : (
          <p className="text-xs text-muted">(본문이 비어 있습니다)</p>
        )}
      </Section>
    </div>
  );
}
