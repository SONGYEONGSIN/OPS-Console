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

  it("빠진 필드 이름을 배지에 그대로 보여준다 — '형식'만으론 뭘 고칠지 모른다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    const link = screen.getByRole("link", { name: /경위서 발송 절차/ });
    expect(link.textContent).toContain("owner");
  });

  it("여러 개가 빠지면 다 보여준다 — 급한 정도가 다르다", () => {
    const groups: KnowledgeGroup[] = [
      {
        category: "개념",
        docs: [
          {
            ...GROUPS[0].docs[0],
            path: "개념/x.md",
            category: "개념",
            title: "x",
            missing: ["owner", "updated"],
          },
        ],
      },
    ];
    render(<KnowledgeTree groups={groups} selected={null} />);
    const link = screen.getByRole("link", { name: /x/ });
    expect(link.textContent).toContain("owner");
    expect(link.textContent).toContain("updated");
  });

  it("분류가 어긋난 문서는 '분류'로 표시한다", () => {
    const groups: KnowledgeGroup[] = [
      {
        category: "개념",
        docs: [
          {
            ...GROUPS[0].docs[1],
            path: "개념/y.md",
            category: "개념",
            title: "y",
            missing: [],
            categoryMismatch: true,
          },
        ],
      },
    ];
    render(<KnowledgeTree groups={groups} selected={null} />);
    expect(
      screen.getByRole("link", { name: /y/ }).textContent,
    ).toContain("분류");
  });

  it("분류 제목에 건수를 단다 — 미분류가 전체의 몇인지 보여야 한다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    const heading = screen.getByRole("heading", { name: /플레이북/ });
    expect(heading.textContent).toContain("2");
  });

  it("검색 중에는 걸러진 건수를 센다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    fireEvent.change(screen.getByLabelText("지식망 검색"), {
      target: { value: "백업" },
    });
    expect(
      screen.getByRole("heading", { name: /플레이북/ }).textContent,
    ).toContain("1");
  });

  it("검색 결과가 없으면 그렇다고 말한다", () => {
    render(<KnowledgeTree groups={GROUPS} selected={null} />);
    fireEvent.change(screen.getByLabelText("지식망 검색"), {
      target: { value: "존재하지않는말" },
    });
    expect(screen.getByText(/찾는 문서가 없습니다/)).toBeInTheDocument();
  });
});
