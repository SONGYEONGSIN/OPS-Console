"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import {
  PERMISSION_LABEL,
  type OperatorPermission,
} from "@/features/operators/schemas";
import { STATUS_LABEL, STATUS_COLOR } from "../status";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

const PERMISSION_COLOR: Record<OperatorPermission, string> = {
  admin: "bg-vermilion/30 text-vermilion-deep font-medium",
  member: "bg-ink/15 text-ink font-medium",
  viewer: "bg-muted/30 text-ink-soft font-medium",
};

export function TeamTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">팀</th>
          <th className="px-3 py-2">이름</th>
          <th className="px-3 py-2">직급</th>
          <th className="px-3 py-2">이메일</th>
          <th className="px-3 py-2">권한</th>
          <th className="px-3 py-2">상태</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={6} className="px-3 py-6 text-center text-muted">
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
              <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
              <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
              <td className="px-3 py-2 text-sm text-ink-soft">{row.meta}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted">{row.id}</td>
              <td className="px-3 py-2">
                {row.permission ? (
                  <span
                    className={`inline-block px-2 py-0.5 text-xs ${PERMISSION_COLOR[row.permission]}`}
                  >
                    {PERMISSION_LABEL[row.permission]}
                  </span>
                ) : (
                  <span className="text-xs text-muted">-</span>
                )}
              </td>
              <td className="px-3 py-2">
                <span
                  className={`inline-block px-2 py-0.5 text-xs ${STATUS_COLOR[row.status]}`}
                >
                  {STATUS_LABEL[row.status]}
                </span>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
