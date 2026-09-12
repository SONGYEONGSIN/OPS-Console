import { describe, it, expect } from "vitest";
import { candidateToListRow } from "../_row-mapper";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

const candidate: AiTipCandidateRow = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "pending",
  collected_at: "2026-09-01T00:30:00.000Z",
  repo_full_name: "anthropics/claude-code",
  repo_url: "https://github.com/anthropics/claude-code",
  stars: 1234,
  repo_description: "터미널에서 도는 코딩 에이전트",
  draft_title: "클로드 코드로 반복 작업 줄이기",
  draft_summary_md: "터미널에서 바로 코드를 고친다.",
  draft_reuse_prompt: "이 리포를 우리 레포에 붙이려면…",
  draft_tags: ["cli", "agent"],
  draft_ai_tool: "claude",
  draft_category: "code",
  repo_language: "TypeScript",
  repo_pushed_at: "2026-09-05T00:30:00.000Z",
  repo_synced_at: "2026-09-12T00:30:00.000Z",
};

describe("candidateToListRow", () => {
  it("후보 필드를 tipCandidate* 로 옮긴다", () => {
    const row = candidateToListRow(candidate, true);
    expect(row.id).toBe(candidate.id);
    expect(row.name).toBe("클로드 코드로 반복 작업 줄이기");
    expect(row.tipCandidateStatus).toBe("pending");
    expect(row.tipCandidateRepoFullName).toBe("anthropics/claude-code");
    expect(row.tipCandidateRepoUrl).toBe(
      "https://github.com/anthropics/claude-code",
    );
    expect(row.tipCandidateRepoDescription).toBe("터미널에서 도는 코딩 에이전트");
    expect(row.tipCandidateStars).toBe(1234);
    expect(row.tipCandidateCollectedAt).toBe("2026-09-01T00:30:00.000Z");
  });

  it("언어·최근 업데이트·조회시각을 tipCandidate* 로 옮긴다", () => {
    const row = candidateToListRow(candidate, true);
    expect(row.tipCandidateRepoLanguage).toBe("TypeScript");
    expect(row.tipCandidateRepoPushedAt).toBe("2026-09-05T00:30:00.000Z");
    expect(row.tipCandidateRepoSyncedAt).toBe("2026-09-12T00:30:00.000Z");
  });

  it("조회 안 한 후보는 세 칸이 null 로 간다 — 빈 문자열로 바꾸면 조회한 것처럼 보인다", () => {
    const row = candidateToListRow(
      {
        ...candidate,
        repo_language: null,
        repo_pushed_at: null,
        repo_synced_at: null,
      },
      true,
    );
    expect(row.tipCandidateRepoLanguage).toBeNull();
    expect(row.tipCandidateRepoPushedAt).toBeNull();
    expect(row.tipCandidateRepoSyncedAt).toBeNull();
  });

  it("초안 필드는 ai-work 와 같은 칸을 쓴다 — 인스펙터가 이미 그 칸을 그린다", () => {
    const row = candidateToListRow(candidate, true);
    expect(row.summary).toBe("터미널에서 바로 코드를 고친다.");
    expect(row.reusePrompt).toBe("이 리포를 우리 레포에 붙이려면…");
    expect(row.tags).toEqual(["cli", "agent"]);
    expect(row.aiTool).toBe("claude");
    expect(row.category).toBe("code");
    // 후보에는 등록자가 없다 — 아직 아무도 자기 것이라 하지 않았다.
    expect(row.owner).toBe("");
  });

  it("초안 제목이 없으면 name 이 빈 문자열이다 — 리포명으로 대체하지 않는다", () => {
    const row = candidateToListRow({ ...candidate, draft_title: null }, true);
    expect(row.name).toBe("");
    expect(row.name).not.toBe("anthropics/claude-code");
  });

  it("status 는 항상 active — 도메인 상태는 tipCandidateStatus 로만 간다", () => {
    for (const s of ["pending", "promoted", "hidden"] as const) {
      const row = candidateToListRow({ ...candidate, status: s }, true);
      expect(row.status).toBe("active");
      expect(row.tipCandidateStatus).toBe(s);
    }
  });

  it("viewer 면 tipCandidateCanDecide 가 false", () => {
    expect(candidateToListRow(candidate, false).tipCandidateCanDecide).toBe(
      false,
    );
    expect(candidateToListRow(candidate, true).tipCandidateCanDecide).toBe(true);
  });

  it("초안이 통째로 비어도 빈 값으로 떨어진다", () => {
    const row = candidateToListRow(
      {
        ...candidate,
        repo_description: null,
        draft_title: null,
        draft_summary_md: null,
        draft_reuse_prompt: null,
        draft_tags: [],
        draft_ai_tool: null,
        draft_category: null,
      },
      true,
    );
    expect(row.tipCandidateRepoDescription).toBeNull();
    expect(row.summary).toBe("");
    expect(row.reusePrompt).toBeNull();
    expect(row.tags).toEqual([]);
    expect(row.aiTool).toBeUndefined();
    expect(row.category).toBeUndefined();
    // 리포 정보는 초안과 무관하게 살아 있어야 한다 — 그게 후보의 뼈대다.
    expect(row.tipCandidateRepoFullName).toBe("anthropics/claude-code");
  });
});
