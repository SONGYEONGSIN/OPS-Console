import { describe, it, expect } from "vitest";
import {
  aiTipCandidateRowSchema,
  aiTipCandidateInsertSchema,
  aiTipCandidateBatchSchema,
} from "../schemas";

const validRow = {
  id: "11111111-1111-4111-8111-111111111111",
  repo_full_name: "acme/agent-kit",
  repo_url: "https://github.com/acme/agent-kit",
  stars: 350,
  repo_description: "에이전트 워크플로 도구",
  draft_title: "에이전트 워크플로 자동화",
  draft_summary_md: "요약",
  draft_reuse_prompt: "프롬프트",
  draft_tags: ["자동화"],
  draft_ai_tool: "claude",
  draft_category: "automation",
  status: "pending",
  collected_at: "2026-08-11T00:00:00Z",
};

describe("aiTipCandidateRowSchema", () => {
  it("정상 행을 통과시킨다", () => {
    expect(aiTipCandidateRowSchema.safeParse(validRow).success).toBe(true);
  });

  it("초안이 전부 없어도 통과한다 — claude 실패는 정상 경로다", () => {
    const parsed = aiTipCandidateRowSchema.safeParse({
      ...validRow,
      draft_title: null,
      draft_summary_md: null,
      draft_reuse_prompt: null,
      draft_ai_tool: null,
      draft_category: null,
      draft_tags: [],
    });
    expect(parsed.success).toBe(true);
  });

  it("정의되지 않은 status는 거부한다", () => {
    expect(
      aiTipCandidateRowSchema.safeParse({ ...validRow, status: "archived" })
        .success,
    ).toBe(false);
  });
});

describe("aiTipCandidateInsertSchema", () => {
  it("리포 정보만으로도 통과한다", () => {
    const parsed = aiTipCandidateInsertSchema.safeParse({
      repo_full_name: "acme/agent-kit",
      repo_url: "https://github.com/acme/agent-kit",
      stars: 350,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.draft_tags).toEqual([]);
  });

  it("repo_full_name이 없으면 거부한다", () => {
    expect(
      aiTipCandidateInsertSchema.safeParse({
        repo_url: "https://github.com/acme/agent-kit",
      }).success,
    ).toBe(false);
  });
});

describe("aiTipCandidateBatchSchema", () => {
  it("빈 배열도 통과한다 — 수집 0건은 실패가 아니다", () => {
    expect(
      aiTipCandidateBatchSchema.safeParse({ candidates: [] }).success,
    ).toBe(true);
  });
});
