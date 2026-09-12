import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { AiTipCandidateTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "클로드 코드로 반복 작업 줄이기",
  status: "active",
  owner: "",
  summary: "터미널에서 바로 코드를 고친다.",
  tipCandidateStatus: "pending",
  tipCandidateRepoFullName: "anthropics/claude-code",
  tipCandidateRepoUrl: "https://github.com/anthropics/claude-code",
  tipCandidateRepoDescription: "터미널에서 도는 코딩 에이전트",
  tipCandidateStars: 1234,
  // KST 로 9/1 09:30 — UTC 그대로 찍으면 8/31 로 하루 밀린다.
  tipCandidateCollectedAt: "2026-09-01T00:30:00.000Z",
  tipCandidateCanDecide: true,
};

describe("AiTipCandidateTable", () => {
  it("제목·리포지터리·별·수집일·검토 다섯 칸을 그린다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(heads).toEqual(["제목", "리포지터리", "별", "수집일", "검토"]);
  });

  it("초안 제목이 없으면 그렇다고 표시한다 — 빈칸이면 왜 비었는지 모른다", () => {
    render(
      <AiTipCandidateTable
        rows={[{ ...baseRow, name: "", summary: undefined }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/초안 없음/)).toBeInTheDocument();
  });

  it("리포 링크는 새 탭으로 연다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const link = screen.getByRole("link", { name: "anthropics/claude-code" });
    expect(link).toHaveAttribute(
      "href",
      "https://github.com/anthropics/claude-code",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("수집일은 KST 로 찍는다 — UTC 그대로면 하루 밀린다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText(/2026\D+09\D+01/)).toBeInTheDocument();
  });

  it("행을 누르면 onSelect 에 그 행이 간다", () => {
    const onSelect = vi.fn();
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByText("클로드 코드로 반복 작업 줄이기"));
    expect(onSelect).toHaveBeenCalledWith(baseRow);
  });

  it("0건이면 빈 상태 문구를 보여준다", () => {
    render(
      <AiTipCandidateTable rows={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("수집된 후보 없음")).toBeInTheDocument();
  });

  it("별은 tabular-nums 로 찍는다 — font-mono 는 식별자 전용이다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const cell = screen.getByText("1234");
    expect(cell.className).toContain("tabular-nums");
    expect(cell.className).not.toContain("font-mono");
  });
});
