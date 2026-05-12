"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import { STATUS_COLOR } from "../status";

type PostVariant = "post-feedback" | "post-notice";

type Props = {
  variant: PostVariant;
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

/**
 * post-feedback 4단계 흐름 — 등록자가 글 등록(요청) → admin이 확인 → 처리중 → 처리완료.
 * STATUS_COLOR는 의미 일관(urgent=red 강조 / approved=muted 종료)이라 그대로 사용.
 */
const FEEDBACK_STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "요청",
  review: "확인",
  active: "처리중",
  approved: "처리완료",
  inactive: "보류",
  suspended: "중단",
  deleted: "삭제",
};

/**
 * post-notice 3단계 흐름 — 긴급(우선 강조) / 활성(현재 게시 중) / 종료(지난 공지).
 */
const NOTICE_STATUS_LABEL: Record<ListRow["status"], string> = {
  urgent: "긴급",
  active: "활성",
  approved: "종료",
  review: "예약",
  inactive: "보류",
  suspended: "중단",
  deleted: "삭제",
};

function postLabelFor(
  variant: PostVariant,
): Record<ListRow["status"], string> {
  return variant === "post-notice" ? NOTICE_STATUS_LABEL : FEEDBACK_STATUS_LABEL;
}

const FEEDBACK_STATUS_KEYS: ListRow["status"][] = [
  "urgent",
  "review",
  "active",
  "approved",
];

const NOTICE_STATUS_KEYS: ListRow["status"][] = ["urgent", "active", "approved"];

export function postStatusKeys(variant: PostVariant): ListRow["status"][] {
  return variant === "post-notice" ? NOTICE_STATUS_KEYS : FEEDBACK_STATUS_KEYS;
}

export function postStatusLabel(
  variant: PostVariant,
  status: ListRow["status"],
): string {
  return postLabelFor(variant)[status];
}

export function PostTable({ variant, rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">ID</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">상태</th>
          <th className="px-3 py-2">등록자</th>
          {variant === "post-feedback" && <th className="px-3 py-2">담당</th>}
          <th className="px-3 py-2">작성일</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td
              colSpan={variant === "post-notice" ? 5 : 6}
              className="px-3 py-6 text-center text-muted"
            >
              데이터 없음
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr
              key={row.id}
              onClick={() => onSelect(row)}
              className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                selectedId === row.id ? "bg-washi-raised" : ""
              } ${row.status === "deleted" ? "opacity-50 [&_td]:line-through" : ""}`}
            >
              <td className="px-3 py-2 font-mono text-xs text-muted">
                {row.slug ?? row.id.slice(0, 8)}
              </td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}
                >
                  {postStatusLabel(variant, row.status)}
                </span>
              </td>
              <td className="px-3 py-2 text-sm text-ink-soft">
                {row.author ?? "-"}
              </td>
              {variant === "post-feedback" && (
                <td className="px-3 py-2 text-sm text-ink-soft">
                  {row.owner || "-"}
                </td>
              )}
              <td className="px-3 py-2 text-xs text-muted">
                {row.meta ?? "-"}
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
