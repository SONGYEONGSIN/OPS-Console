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
  tipCandidateRepoLanguage: "TypeScript",
  // KST 로 9/5 — 수집일(9/1)과 다른 날로 둬야 두 날짜 칸이 섞이지 않는다.
  tipCandidateRepoPushedAt: "2026-09-04T20:30:00.000Z",
  tipCandidateRepoSyncedAt: "2026-09-12T00:30:00.000Z",
  tipCandidateCanDecide: true,
};

describe("AiTipCandidateTable", () => {
  it("제목·리포지터리·언어·별·최근 업데이트·수집일·검토 일곱 칸을 그린다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    // 리포의 사실(리포지터리·언어·별·최근 업데이트) 다음에 우리 과정의 사실(수집일·검토).
    expect(heads).toEqual([
      "제목",
      "리포지터리",
      "언어",
      "별",
      "최근 업데이트",
      "수집일",
      "검토",
    ]);
  });

  it("언어와 최근 업데이트를 그린다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    // 푸시는 KST 9/5 — UTC 그대로면 9/4 로 하루 밀린다.
    expect(screen.getByText(/2026\D+09\D+05/)).toBeInTheDocument();
  });

  it("조회 안 한 행은 언어·최근 업데이트를 '—' 로 둔다", () => {
    render(
      <AiTipCandidateTable
        rows={[
          {
            ...baseRow,
            tipCandidateRepoLanguage: null,
            tipCandidateRepoPushedAt: null,
            tipCandidateRepoSyncedAt: null,
          },
        ]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getAllByText("—")).toHaveLength(2);
    expect(screen.queryByText("없음")).not.toBeInTheDocument();
  });

  it("주 언어가 없는 리포는 '없음' — 대시와 구분한다", () => {
    render(
      <AiTipCandidateTable
        rows={[{ ...baseRow, tipCandidateRepoLanguage: null }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("없음")).toBeInTheDocument();
  });

  it("두 날짜 칸은 tabular-nums 로 찍는다 — 자릿수가 어긋나면 못 견준다", () => {
    render(
      <AiTipCandidateTable
        rows={[baseRow]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    for (const re of [/2026\D+09\D+05/, /2026\D+09\D+01/]) {
      expect(screen.getByText(re).className).toContain("tabular-nums");
    }
  });

  it("0건 안내는 표 폭을 가득 채운다 — 일곱 칸이 됐다", () => {
    render(
      <AiTipCandidateTable rows={[]} selectedId={null} onSelect={vi.fn()} />,
    );
    expect(screen.getByText("수집된 후보 없음")).toHaveAttribute(
      "colspan",
      "7",
    );
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
