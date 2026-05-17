import { useState } from "react";
import type { ViewProps } from "../types";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";

export function AiWorkView({ row }: ViewProps) {
  const [copied, setCopied] = useState(false);
  const tool = row.aiTool as AiTool | undefined;
  const cat = row.category as AiWorkCategory | undefined;

  const handleCopy = async () => {
    if (!row.reusePrompt) return;
    try {
      await navigator.clipboard.writeText(row.reusePrompt);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="space-y-5 text-sm text-ink">
      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">메타</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-xs">
            <span className="text-muted">작업 기간</span>{" "}
            <span className="font-mono text-ink">
              {row.workStartDate ?? "—"}
              {row.workEndDate && row.workEndDate !== row.workStartDate
                ? ` ~ ${row.workEndDate}`
                : ""}
            </span>
          </span>
          {tool && (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
            >
              {AI_TOOL_LABEL[tool] ?? tool}
            </span>
          )}
          {cat && (
            <span
              className={`inline-block px-2 py-0.5 text-2xs ${CATEGORY_TONE[cat] ?? ""}`}
            >
              {CATEGORY_LABEL[cat] ?? cat}
            </span>
          )}
          <span className="text-xs">
            <span className="text-muted">등록자</span>{" "}
            <span className="text-ink">{row.owner}</span>
          </span>
          {typeof row.savedHours === "number" && (
            <span className="text-xs">
              <span className="text-muted">절감</span>{" "}
              <span className="font-mono text-ink">{row.savedHours} 시간</span>
            </span>
          )}
        </div>
      </section>

      <section className="space-y-1.5">
        <p className="text-2xs uppercase tracking-[0.18em] text-muted">요약</p>
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {row.summary ?? "요약 없음"}
        </p>
      </section>

      {row.outputUrl && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">결과물</p>
          <a
            href={row.outputUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block break-all text-xs text-vermilion underline hover:text-vermilion-deep"
          >
            {row.outputUrl}
          </a>
        </section>
      )}

      {row.reusePrompt && (
        <section className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <p className="text-2xs uppercase tracking-[0.18em] text-muted">
              재사용 프롬프트
            </p>
            <button
              type="button"
              onClick={handleCopy}
              className="border border-line bg-transparent px-2 py-0.5 text-2xs text-ink hover:bg-washi"
            >
              {copied ? "복사됨" : "프롬프트 복사"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-none border border-line bg-washi-raised px-3 py-2 text-xs leading-relaxed text-ink">
            {row.reusePrompt}
          </pre>
        </section>
      )}

      {row.tags && row.tags.length > 0 && (
        <section className="space-y-1.5">
          <p className="text-2xs uppercase tracking-[0.18em] text-muted">태그</p>
          <div className="flex flex-wrap gap-1.5">
            {row.tags.map((t) => (
              <span
                key={t}
                className="inline-block bg-line-soft px-2 py-0.5 text-2xs text-ink-soft"
              >
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
