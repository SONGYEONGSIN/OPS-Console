import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TipCandidatePanel } from "../TipCandidatePanel";
import type { AiTipCandidateRow } from "@/features/ai-tip-candidates/schemas";

function candidate(over: Partial<AiTipCandidateRow> = {}): AiTipCandidateRow {
  return {
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
    ...over,
  };
}

describe("TipCandidatePanel", () => {
  it("후보가 없으면 아무것도 그리지 않는다", () => {
    const { container } = render(
      <TipCandidatePanel
        candidates={[]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("후보 건수와 리포 정보를 보여준다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate()]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(screen.getByText(/수집된 후보/)).toBeInTheDocument();
    expect(screen.getByText("acme/agent-kit")).toBeInTheDocument();
    expect(screen.getByText(/350/)).toBeInTheDocument();
    expect(screen.getByText("에이전트 워크플로 자동화")).toBeInTheDocument();
  });

  it("초안이 없는 후보는 '초안 없음'으로 표시한다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate({ draft_title: null, draft_summary_md: null })]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(screen.getByText(/초안 없음/)).toBeInTheDocument();
  });

  it("등록·숨김 버튼이 있다", () => {
    render(
      <TipCandidatePanel
        candidates={[candidate()]}
        onPromote={vi.fn()}
        onHide={vi.fn()}
      />,
    );
    expect(
      screen.getByRole("button", { name: "TIP으로 등록" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "숨김" })).toBeInTheDocument();
  });

  it("onPromote가 reject해도 버튼이 다시 활성화된다", async () => {
    const onPromote = vi.fn().mockRejectedValue(new Error("network"));
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    render(
      <TipCandidatePanel
        candidates={[candidate()]}
        onPromote={onPromote}
        onHide={vi.fn()}
      />,
    );
    const button = screen.getByRole("button", { name: "TIP으로 등록" });
    fireEvent.click(button);
    await waitFor(() => expect(button).not.toBeDisabled());
    alertSpy.mockRestore();
  });
});
