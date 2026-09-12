import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiTipCandidateView } from "../View";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "클로드 코드로 반복 작업 줄이기",
  status: "active",
  owner: "",
  summary: "터미널에서 바로 코드를 고친다.",
  reusePrompt: "이 리포를 우리 업무에 적용할 방법을 정리해줘.",
  tags: ["반복작업", "에이전트"],
  aiTool: "claude",
  category: "automation",
  tipCandidateStatus: "pending",
  tipCandidateRepoFullName: "anthropics/claude-code",
  tipCandidateRepoUrl: "https://github.com/anthropics/claude-code",
  tipCandidateRepoDescription: "터미널에서 도는 코딩 에이전트",
  tipCandidateStars: 1234,
  // KST 로 9/1 09:30 — UTC 그대로 찍으면 8/31 로 하루 밀린다.
  tipCandidateCollectedAt: "2026-09-01T00:30:00.000Z",
  tipCandidateCanDecide: true,
};

describe("AiTipCandidateView — 상세", () => {
  it("초안 요약과 재사용 프롬프트를 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("터미널에서 바로 코드를 고친다.")).toBeInTheDocument();
    expect(
      screen.getByText("이 리포를 우리 업무에 적용할 방법을 정리해줘."),
    ).toBeInTheDocument();
  });

  it("태그를 모두 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("반복작업")).toBeInTheDocument();
    expect(screen.getByText("에이전트")).toBeInTheDocument();
  });

  it("AI 도구·카테고리를 라벨로 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("자동화")).toBeInTheDocument();
  });

  it("리포 설명을 보여준다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText("터미널에서 도는 코딩 에이전트")).toBeInTheDocument();
  });

  it("별은 수집 시점 값이라고 함께 적는다 — 라벨이 없으면 지금 별로 읽힌다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/1,?234/)).toBeInTheDocument();
    expect(screen.getByText(/수집 시점/)).toBeInTheDocument();
  });

  it("수집일은 KST 로 찍는다 — UTC 그대로면 하루 밀린다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    expect(screen.getByText(/2026\D+09\D+01/)).toBeInTheDocument();
  });

  it("'레포로 이동' 은 새 탭으로 열고 호버는 검정 배경이다", () => {
    render(<AiTipCandidateView row={baseRow} />);
    const link = screen.getByRole("link", { name: /레포로 이동/ });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/anthropics/claude-code",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
    expect(link.className).toContain("hover:bg-ink");
    expect(link.className).toContain("hover:text-cream");
  });

  it("초안이 없으면 없다고 말한다 — 빈칸이면 왜 비었는지 모른다", () => {
    render(
      <AiTipCandidateView
        row={{
          ...baseRow,
          summary: "",
          reusePrompt: null,
          tags: [],
          aiTool: undefined,
          category: undefined,
        }}
      />,
    );
    // 비는 자리는 넷이다 — 요약·프롬프트·AI 도구·카테고리.
    expect(screen.getAllByText(/초안 없음/)).toHaveLength(4);
  });

  it("DB 에 없는 칸을 만들지 않는다 — 언어·최근 업데이트·사용 시점", () => {
    const { container } = render(<AiTipCandidateView row={baseRow} />);
    const text = container.textContent ?? "";
    for (const absent of ["언어", "최근 업데이트", "사용 시점", "사용 방법"]) {
      expect(text).not.toContain(absent);
    }
  });
});
