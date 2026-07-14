import type { ReactNode } from "react";
import { useState } from "react";
import type { ViewProps } from "../types";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";
import { Section, DefList, Divider } from "../shared";

export function AiTipsView({ row }: ViewProps) {
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
    <div className="space-y-6">
      <Section title="정보">
        <DefList
          items={
            [
              {
                term: "AI 도구",
                desc: tool ? (
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
                  >
                    {AI_TOOL_LABEL[tool] ?? tool}
                  </span>
                ) : (
                  "—"
                ),
              },
              {
                term: "카테고리",
                desc: cat ? (
                  <span
                    className={`inline-block px-2 py-0.5 text-2xs ${CATEGORY_TONE[cat] ?? ""}`}
                  >
                    {CATEGORY_LABEL[cat] ?? cat}
                  </span>
                ) : (
                  "—"
                ),
              },
              { term: "등록자", desc: row.owner },
            ] as { term: string; desc: ReactNode }[]
          }
        />
      </Section>

      <Divider />

      <Section title="요약">
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
          {row.summary ?? "요약 없음"}
        </p>
      </Section>

      <Divider />

      <Section title="재사용 프롬프트">
        <div className="space-y-2">
          {row.reusePrompt && (
            <button
              type="button"
              onClick={handleCopy}
              className="cursor-pointer border border-line bg-transparent px-2 py-0.5 text-2xs text-ink hover:bg-line-soft"
            >
              {copied ? "복사됨" : "프롬프트 복사"}
            </button>
          )}
          {row.reusePrompt ? (
            <pre className="whitespace-pre-wrap border border-line bg-washi-raised px-3 py-2 text-xs leading-relaxed text-ink">
              {row.reusePrompt}
            </pre>
          ) : (
            <p className="text-2xs text-muted">프롬프트가 등록되지 않았습니다.</p>
          )}
        </div>
      </Section>

      {row.tags && row.tags.length > 0 && (
        <>
          <Divider />
          <Section title="태그">
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
          </Section>
        </>
      )}
    </div>
  );
}
