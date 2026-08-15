import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { KnowledgeTree } from "../KnowledgeTree";
import type { KnowledgeGroup } from "@/features/knowledge/shared";

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard/knowledge" }));

const GROUPS: KnowledgeGroup[] = [
  {
    category: "플레이북",
    docs: [
      {
        path: "플레이북/경위서 발송 절차.md",
        category: "플레이북",
        title: "경위서 발송 절차",
        owner: null,
        updated: "2026-08-15",
        related: [],
        missing: ["owner"],
        categoryMismatch: false,
      },
      {
        path: "플레이북/백업 요청 그룹별 발송.md",
        category: "플레이북",
        title: "백업 요청 그룹별 발송",
        owner: "나",
        updated: "2026-08-15",
        related: [],
        missing: [],
        categoryMismatch: false,
      },
    ],
  },
  {
    category: "규칙",
    docs: [
      {
        path: "규칙/메일 자동 CC 제외 대상.md",
        category: "규칙",
        title: "메일 자동 CC 제외 대상",
        owner: "나",
        updated: "2026-08-15",
        related: [],
        missing: [],
        categoryMismatch: false,
      },
    ],
  },
];

describe("KnowledgeTree", () => {
  it("분류별로 문서를 보여준다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    expect(screen.getByText("플레이북")).toBeInTheDocument();
    expect(screen.getByText("규칙")).toBeInTheDocument();
    expect(screen.getByText("경위서 발송 절차")).toBeInTheDocument();
  });

  it("검색하면 제목이 맞는 것만 남는다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    fireEvent.change(screen.getByLabelText("지식망 검색"), {
      target: { value: "백업" },
    });
    expect(screen.getByText("백업 요청 그룹별 발송")).toBeInTheDocument();
    expect(screen.queryByText("경위서 발송 절차")).toBeNull();
  });

  it("검색어에 맞는 문서가 없는 분류는 통째로 감춘다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    fireEvent.change(screen.getByLabelText("지식망 검색"), {
      target: { value: "백업" },
    });
    expect(screen.queryByText("규칙")).toBeNull();
  });

  it("선택된 문서를 aria-current로 표시한다", () => {
    render(
      <KnowledgeTree
        groups={GROUPS}
        selected="플레이북/경위서 발송 절차.md"
      />,
    );
    const link = screen.getByRole("link", { name: /경위서 발송 절차/ });
    expect(link).toHaveAttribute("aria-current", "page");
  });

  it("형식 미비 문서에 표시를 단다 — 고칠 것이 눈에 보여야 한다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    const link = screen.getByRole("link", { name: /경위서 발송 절차/ });
    expect(link.textContent).toContain("형식");
  });

  it("검색 결과가 없으면 그렇다고 말한다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    fireEvent.change(screen.getByLabelText("지식망 검색"), {
      target: { value: "존재하지않는말" },
    });
    expect(screen.getByText(/찾는 문서가 없습니다/)).toBeInTheDocument();
  });
});
