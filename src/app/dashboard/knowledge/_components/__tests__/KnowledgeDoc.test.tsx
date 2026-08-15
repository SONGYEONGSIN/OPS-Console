import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { KnowledgeDocView } from "../KnowledgeDoc";
import type { KnowledgeDocFull } from "@/features/knowledge/shared";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/knowledge" }));

function doc(p: Partial<KnowledgeDocFull> = {}): KnowledgeDocFull {
  return {
    path: "플레이북/경위서 발송 절차.md",
    category: "플레이북",
    title: "경위서 발송 절차",
    owner: "송영신",
    updated: "2026-08-15",
    related: [],
    missing: [],
    categoryMismatch: false,
    body: "## 무엇\n\n승인 완료된 경위서를 보낸다.",
    ...p,
  };
}

describe("KnowledgeDocView", () => {
  it("제목·분류·작성자·수정일을 머리에 보여준다", () => {
    render(<KnowledgeDocView doc={doc()} allPaths={[]} />);
    expect(screen.getByRole("heading", { name: "경위서 발송 절차" })).toBeInTheDocument();
    expect(screen.getByText("플레이북")).toBeInTheDocument();
    expect(screen.getByText(/송영신/)).toBeInTheDocument();
    expect(screen.getByText(/2026-08-15/)).toBeInTheDocument();
  });

  it("마크다운을 렌더한다 — 원문 기호가 그대로 보이지 않는다", () => {
    render(<KnowledgeDocView doc={doc()} allPaths={[]} />);
    expect(screen.getByRole("heading", { name: "무엇" })).toBeInTheDocument();
    expect(screen.queryByText("## 무엇")).toBeNull();
  });

  it("6개월 넘은 문서에 신선도 경고를 띄운다", () => {
    // 낡은 지식을 낡은 줄 모르고 읽는 게 가장 나쁘다.
    render(<KnowledgeDocView doc={doc({ updated: "2020-01-01" })} allPaths={[]} />);
    expect(screen.getByText(/오래/)).toBeInTheDocument();
  });

  it("형식이 빠진 필드를 이름까지 알려준다", () => {
    render(<KnowledgeDocView doc={doc({ owner: null, missing: ["owner"] })} allPaths={[]} />);
    expect(screen.getByText(/owner/)).toBeInTheDocument();
  });

  it("related 중 실제로 있는 문서만 링크로 만든다", () => {
    // 없는 문서로 링크를 걸면 눌렀을 때 빈 화면이 나온다.
    render(
      <KnowledgeDocView
        doc={doc({ related: ["공문 시행번호 채번 규칙", "없는 문서"] })}
        allPaths={["개념/공문 시행번호 채번 규칙.md"]}
      />,
    );
    expect(screen.getByRole("link", { name: "공문 시행번호 채번 규칙" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "없는 문서" })).toBeNull();
    expect(screen.getByText("없는 문서")).toBeInTheDocument();
  });

  it("분류가 어긋난 문서는 폴더가 이긴다고 알려준다", () => {
    render(<KnowledgeDocView doc={doc({ categoryMismatch: true })} allPaths={[]} />);
    expect(
      screen.getByText(/화면은 폴더를 따릅니다/),
    ).toBeInTheDocument();
  });
});
