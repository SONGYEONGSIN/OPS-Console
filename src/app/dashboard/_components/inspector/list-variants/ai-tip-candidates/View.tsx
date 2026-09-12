"use client";

import type { ReactNode } from "react";
import type { ViewProps } from "../types";
import { Section, DefList, Divider } from "../shared";
import {
  AI_TOOL_LABEL,
  AI_TOOL_TONE,
  CATEGORY_LABEL,
  CATEGORY_TONE,
} from "@/lib/ai-work/constants";
import type { AiTool, AiWorkCategory } from "@/features/ai-work/schemas";
import { kstFormat } from "@/lib/kst-format";

/** 수집일 — 날짜만. 시각까지는 후보를 훑는 데 짐만 된다(표와 같은 셈). */
const COLLECTED_DATE = kstFormat({
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function formatCollectedAt(iso: string | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  // 화면에 `Invalid Date` 를 흘리지 않는다.
  if (Number.isNaN(d.getTime())) return "—";
  return COLLECTED_DATE.format(d);
}

/** 초안이 비었다는 사실을 그대로 말한다 — 빈칸은 왜 비었는지 알려주지 않는다. */
function DraftMissing({ what }: { what: string }) {
  return <span className="text-2xs text-muted">초안 없음 — {what}</span>;
}

/**
 * TIP 후보 인스펙터 읽기 화면.
 *
 * **DB 에 있는 칸만 그린다.** 언어·최근 업데이트·'사용 시점/사용 방법' 은
 * `ai_tip_candidates` 에 컬럼이 없다. 자리를 만들어 `-` 로 채우면 값이 있는데
 * 비어 보이는 것과 구분이 안 된다.
 */
export function AiTipCandidateView({ row }: ViewProps) {
  const tool = row.aiTool as AiTool | undefined;
  const cat = row.category as AiWorkCategory | undefined;
  const repoUrl = row.tipCandidateRepoUrl;

  const items: { term: string; desc: ReactNode }[] = [
    {
      term: "리포지터리",
      desc: (
        <span className="text-ink">{row.tipCandidateRepoFullName ?? "—"}</span>
      ),
    },
    {
      term: "리포 설명",
      desc: row.tipCandidateRepoDescription ? (
        <span className="text-ink">{row.tipCandidateRepoDescription}</span>
      ) : (
        <span className="text-muted">—</span>
      ),
    },
    {
      term: "별",
      desc: (
        <span className="text-ink">
          {/* 별은 세는 값이라 tabular-nums — font-mono 는 식별자 전용. */}
          <span className="tabular-nums">{row.tipCandidateStars ?? 0}</span>
          {/*
            수집 당시 스냅샷이고 재수집으로 갱신되지 않는다. 라벨 없이 숫자만
            두면 지금 별로 읽혀, 반년 전 값을 오늘 인기로 착각한다.
          */}
          <span className="ml-1.5 text-2xs text-muted">— 수집 시점 값</span>
        </span>
      ),
    },
    {
      term: "수집일",
      desc: (
        <span className="tabular-nums text-ink">
          {formatCollectedAt(row.tipCandidateCollectedAt)}
        </span>
      ),
    },
    {
      term: "AI 도구",
      desc: tool ? (
        <span
          className={`inline-block px-2 py-0.5 text-2xs ${AI_TOOL_TONE[tool] ?? ""}`}
        >
          {AI_TOOL_LABEL[tool] ?? tool}
        </span>
      ) : (
        <DraftMissing what="등록 후 직접 지정" />
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
        <DraftMissing what="등록 후 직접 지정" />
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Section title="후보 정보">
        <DefList items={items} />
        {repoUrl && (
          <a
            href={repoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block cursor-pointer border border-line bg-transparent px-3 py-1 text-xs text-ink transition-colors hover:border-ink hover:bg-ink hover:text-cream"
          >
            레포로 이동
          </a>
        )}
      </Section>

      <Divider />

      <Section title="요약">
        {row.summary ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
            {row.summary}
          </p>
        ) : (
          <DraftMissing what="등록 후 직접 작성" />
        )}
      </Section>

      <Divider />

      <Section title="재사용 프롬프트">
        {row.reusePrompt ? (
          <pre className="whitespace-pre-wrap break-words border border-line bg-washi-raised px-3 py-2 text-xs leading-relaxed text-ink">
            {row.reusePrompt}
          </pre>
        ) : (
          <DraftMissing what="등록 후 직접 작성" />
        )}
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
