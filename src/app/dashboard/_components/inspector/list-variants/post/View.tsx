import type { ListRow } from "../../../patterns/ListPattern";
import { Section, DefList, Divider } from "../shared";
import { formatAnnounceAt, postStatusLabel } from "./Table";
import { statusBadgeTone } from "../badge-tone";

export function PostView({
  row,
  variant,
}: {
  row: ListRow;
  variant: "post-feedback" | "post-notice";
}) {
  const statusLabel = postStatusLabel(variant, row.status);
  const statusColor = statusBadgeTone(statusLabel);

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
            // 공지일은 공지사항에만 있는 개념 — 의견·건의에는 항목 자체를 두지 않는다.
            ...(variant === "post-notice"
              ? [
                  {
                    term: "공지일",
                    desc: formatAnnounceAt(row.noticeAnnounceAt),
                  },
                ]
              : []),
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
