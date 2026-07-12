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

function isHttpUrl(u: string | null | undefined): u is string {
  return !!u && /^https?:\/\//i.test(u);
}

export function AiWorkTable({ rows, selectedId, onSelect }: Props) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-line text-left text-xs uppercase tracking-[0.06em] text-muted">
          <th className="px-3 py-2">작업 기간</th>
          <th className="px-3 py-2">제목</th>
          <th className="px-3 py-2">AI 도구</th>
          <th className="px-3 py-2">카테고리</th>
          <th className="px-3 py-2">등록자</th>
          <th className="px-3 py-2">링크</th>
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
          rows.map((row) => {
            const tool = row.aiTool as AiTool | undefined;
            const cat = row.category as AiWorkCategory | undefined;
            return (
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className={`cursor-pointer border-b border-line-soft hover:bg-line-soft ${
                  selectedId === row.id ? "bg-vermilion/10" : ""
                }`}
              >
                <td className="px-3 py-2 text-xs text-ink">
                  {row.workStartDate ?? "—"}
                  {row.workEndDate && row.workEndDate !== row.workStartDate
                    ? ` ~ ${row.workEndDate}`
                    : ""}
                </td>
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
                <td className="px-3 py-2">
                  {isHttpUrl(row.outputUrl) ? (
                    <a
                      href={row.outputUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex w-fit items-center border border-vermilion px-2 py-0.5 text-xs font-medium text-vermilion transition-opacity hover:opacity-90"
                    >
                      바로가기
                    </a>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
