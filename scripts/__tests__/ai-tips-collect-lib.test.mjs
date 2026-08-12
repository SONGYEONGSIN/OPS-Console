import { describe, it, expect } from "vitest";
import {
  TOPICS,
  MAX_PER_RUN,
  buildSearchQuery,
  createdAfterDate,
  pickNewRepos,
  buildTipPrompt,
  parseTipDraft,
} from "../ai-tips/collect-lib.mjs";

describe("createdAfterDate", () => {
  it("기준일에서 N일 전을 YYYY-MM-DD로 준다", () => {
    expect(createdAfterDate(new Date("2026-08-11T00:00:00Z"), 90)).toBe(
      "2026-05-13",
    );
  });
});

describe("buildSearchQuery", () => {
  it("토픽·스타·생성일 조건을 한 줄로 조립한다", () => {
    expect(
      buildSearchQuery("automation", {
        minStars: 200,
        createdAfter: "2026-05-13",
      }),
    ).toBe("topic:automation stars:>=200 created:>2026-05-13");
  });
});

describe("pickNewRepos", () => {
  const items = [
    { full_name: "a/one", html_url: "u1", stargazers_count: 300, description: "d1" },
    { full_name: "b/two", html_url: "u2", stargazers_count: 250, description: null },
    { full_name: "c/three", html_url: "u3", stargazers_count: 210, description: "d3" },
  ];

  it("이미 본 리포를 제외한다", () => {
    const out = pickNewRepos(items, new Set(["b/two"]), 10);
    expect(out.map((r) => r.repo_full_name)).toEqual(["a/one", "c/three"]);
  });

  it("limit까지만 준다 — claude 호출 수가 여기서 정해진다", () => {
    expect(pickNewRepos(items, new Set(), 2)).toHaveLength(2);
  });

  it("같은 리포가 여러 토픽에서 중복으로 와도 한 번만 담는다", () => {
    const dup = [...items, items[0]];
    expect(pickNewRepos(dup, new Set(), 10)).toHaveLength(3);
  });

  it("필요한 필드만 남긴다", () => {
    expect(pickNewRepos([items[0]], new Set(), 1)[0]).toEqual({
      repo_full_name: "a/one",
      repo_url: "u1",
      stars: 300,
      repo_description: "d1",
    });
  });
});

describe("buildTipPrompt", () => {
  it("리포 정보와 README를 프롬프트에 담는다", () => {
    const p = buildTipPrompt(
      { repo_full_name: "a/one", repo_description: "설명" },
      "# README 본문",
    );
    expect(p).toContain("a/one");
    expect(p).toContain("설명");
    expect(p).toContain("# README 본문");
  });

  it("README가 없어도 프롬프트를 만든다", () => {
    expect(buildTipPrompt({ repo_full_name: "a/one" }, "")).toContain("a/one");
  });
});

describe("parseTipDraft", () => {
  const good = JSON.stringify({
    title: "에이전트 워크플로",
    summary_md: "요약",
    reuse_prompt: "프롬프트",
    tags: ["자동화", "에이전트"],
    ai_tool: "claude",
    category: "automation",
  });

  it("JSON을 초안 필드로 바꾼다", () => {
    expect(parseTipDraft(good)).toEqual({
      draft_title: "에이전트 워크플로",
      draft_summary_md: "요약",
      draft_reuse_prompt: "프롬프트",
      draft_tags: ["자동화", "에이전트"],
      draft_ai_tool: "claude",
      draft_category: "automation",
    });
  });

  it("코드펜스로 감싸 와도 읽는다", () => {
    expect(parseTipDraft("```json\n" + good + "\n```")?.draft_title).toBe(
      "에이전트 워크플로",
    );
  });

  it("허용 밖 enum은 안전한 기본값으로 바꾼다", () => {
    const out = parseTipDraft(
      JSON.stringify({
        title: "t",
        summary_md: "s",
        reuse_prompt: "p",
        tags: [],
        ai_tool: "무언가",
        category: "무언가",
      }),
    );
    expect(out?.draft_ai_tool).toBe("etc");
    expect(out?.draft_category).toBe("automation");
  });

  it("JSON이 아니면 null — 초안 없이 저장하라는 신호다", () => {
    expect(parseTipDraft("죄송합니다 만들 수 없습니다")).toBeNull();
  });

  it("필수 필드가 비면 null", () => {
    expect(parseTipDraft(JSON.stringify({ title: "t" }))).toBeNull();
  });
});

describe("상수", () => {
  it("토픽이 비어 있지 않다", () => {
    expect(TOPICS.length).toBeGreaterThan(0);
  });

  it("회차당 처리 건수가 claude 호출 비용을 묶는다", () => {
    expect(MAX_PER_RUN).toBe(5);
  });
});
