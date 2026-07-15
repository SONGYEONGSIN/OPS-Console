"use client";

import { useRouter } from "next/navigation";
import type { ListRow } from "../../../patterns/ListPattern";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

type StatusKey = "none" | "draft" | "ready" | "published";

const STATUS_LABEL: Record<StatusKey, string> = {
  none: "미작성",
  draft: "작성중",
  ready: "작성완료",
  published: "인계완료",
};

const STATUS_TONE: Record<StatusKey, string> = {
  none: "bg-washi-raised text-muted",
  draft: "bg-vermilion/15 text-vermilion",
  ready: "bg-sage/15 text-sage",
  published: "bg-ink/10 text-ink",
};

export function HandoverTable({ rows }: Props) {
  const router = useRouter();
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">대학명 · 서비스</th>
          <th className="px-3 py-2">운영자</th>
          <th className="px-3 py-2">접수구분</th>
          <th className="px-3 py-2">작성상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={4} className="px-3 py-6 text-center text-muted">
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const key = (row.handoverStatus ?? "none") as StatusKey;
            return (
              <tr
                key={row.id}
                onClick={() => router.push(`/dashboard/handover/${row.id}`)}
                className="cursor-pointer border-b border-line-soft transition-colors hover:bg-line-soft"
              >
                <td className="px-3 py-2">
                  <span className="font-medium text-ink">
                    {row.universityName ?? "—"}
                  </span>
                  <span className="ml-1 text-xs text-muted">
                    · {row.serviceName ?? "—"}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-ink-soft">{row.owner}</td>
                <td className="px-3 py-2 text-xs text-ink-soft">
                  {row.applicationType ?? "—"}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${STATUS_TONE[key]}`}
                  >
                    {STATUS_LABEL[key]}
                  </span>
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
