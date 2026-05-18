"use client";

import type { ListRow } from "../../../patterns/ListPattern";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";

type Props = {
  rows: ListRow[];
  selectedId: string | null;
  onSelect: (row: ListRow) => void;
};

export function AiTipsTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">AI 도구</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">등록자</th>
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
            const tool = row.aiTool as AiTool | undefined;
            const cat = row.category as AiWorkCategory | undefined;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-washi-raised ${
                  selectedId === row.id ? "bg-washi-raised" : ""
                }`}
              >
                <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                <td className="px-3 py-2">
                  {tool && (
                    <span
                      className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
                    >
                      {AI_TOOL_LABEL[tool] ?? tool}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {cat && (
                    <span
                      className={`inline-block px-2 py-0.5 text-2xs ${CATEGORY_TONE[cat] ?? ""}`}
                    >
                      {CATEGORY_LABEL[cat] ?? cat}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2 text-sm text-ink-soft">{row.owner}</td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
