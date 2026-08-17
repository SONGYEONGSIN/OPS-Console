import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KnowledgeGaps } from "../KnowledgeGaps";
import type { KnowledgeGapGroup } from "@/features/knowledge/gaps-shared";

const GROUPS: KnowledgeGapGroup[] = [
  {
    topic: "휴가 등록 절차",
    kind: "missing",
    count: 3,
    questions: ["휴가 등록 어떻게해?", "연차 올리는 법"],
    nearPaths: [],
    notes: ["볼트에 근태 문서가 없다"],
  },
  {
    topic: "백업요청 화면 조작",
    kind: "shallow",
    count: 1,
    questions: ["백업요청 어떻게 해?"],
    nearPaths: ["플레이북/백업 요청 그룹별 발송.md"],
    notes: [],
  },
];

describe("KnowledgeGaps", () => {
  it("주제와 물어본 횟수를 보여준다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText("휴가 등록 절차")).toBeInTheDocument();
    expect(screen.getByText(/3/)).toBeInTheDocument();
  });

  it("구분을 라벨로 보여준다 — 새로 쓸 일과 보강할 일은 다르다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText(/문서 없음/)).toBeInTheDocument();
    expect(screen.getByText("내용 부족 · 보강")).toBeInTheDocument();
  });

  it("실제 질문을 그대로 보여준다 — 무엇을 쓸지는 원문이 알려준다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    expect(screen.getByText(/휴가 등록 어떻게해\?/)).toBeInTheDocument();
  });

  it("보강 대상 문서로 바로 갈 수 있다", () => {
    render(<KnowledgeGaps groups={GROUPS} />);
    const link = screen.getByRole("link", { name: /백업 요청 그룹별 발송/ });
    expect(link.getAttribute("href")).toContain("doc=");
  });

  it("빈틈이 없으면 그렇다고 말한다", () => {
    render(<KnowledgeGaps groups={[]} />);
    expect(screen.getByText(/답하지 못한 질문이 없습니다/)).toBeInTheDocument();
  });
});
