import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { TipCandidatePanel } from "../TipCandidatePanel";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

/**
 * 제목과 표 사이는 **28px**(ListPattern 표준).
 *
 * 여기는 `gap-3`(12px)뿐이라 제목이 표에 붙어 보였다(2026-09-01). 우편물 발송목록이
 * 같은 문제를 겪고 정한 셈을 그대로 쓴다 — 부모 `gap-3`(12px) + `mb-4`(16px) = 28px.
 * `mb-7`(28px)로 두면 12px 이 더해져 40px 이 된다.
 */
const row: AiTipCandidateRow = {
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

function panel() {
  return render(
    <TipCandidatePanel candidates={[row]} onPromote={vi.fn()} onHide={vi.fn()} />,
  );
}

describe("TipCandidatePanel — 제목·표 간격", () => {
  it("제목 줄이 아래로 28px 을 만든다 — 부모 12px + mb-4 16px", () => {
    expect(panel().container.querySelector("header")?.className).toContain("mb-4");
  });

  it("mb-7 을 쓰지 않는다 — 부모 gap 과 겹쳐 40px 이 된다", () => {
    expect(panel().container.querySelector("header")?.className).not.toContain("mb-7");
  });
});
