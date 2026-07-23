import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RoundsList } from "../RoundsList";
import type { ChecklistRound } from "@/features/checklist/schemas";
import type { Completion } from "@/features/checklist/completion";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const completion: Completion = {
  total: 10,
  done: 5,
  inProgress: 2,
  todo: 3,
  na: 0,
  pct: 50,
};

const sample: ChecklistRound & { completion: Completion } = {
  id: "11111111-1111-1111-1111-111111111111",
  title: "2027학년도 수시모집",
  periodStart: "2027-01-01",
  periodEnd: "2027-01-31",
  status: "active",
  createdBy: "ys1114@x.com",
  createdAt: "2027-01-01T00:00:00Z",
  reportHtml: null,
  reportGeneratedAt: null,
  completion,
};

describe("RoundsList (표준 테이블)", () => {
  it("빈 rounds → 안내문구", () => {
    render(<RoundsList rounds={[]} />);
    expect(screen.getByText(/모집시기가 없습니다/)).toBeInTheDocument();
  });

  it("행 렌더 — 제목 / 진행 / 완료율 / 기간 / 상태", () => {
    render(<RoundsList rounds={[sample]} />);
    expect(screen.getByText("2027학년도 수시모집")).toBeInTheDocument();
    expect(screen.getByText("5/10")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01 ~ 2027-01-31")).toBeInTheDocument();
    expect(screen.getByText("진행중")).toBeInTheDocument();
  });

  it("행 클릭 → router.push(/dashboard/checklist/[id])", () => {
    push.mockClear();
    render(<RoundsList rounds={[sample]} />);
    fireEvent.click(screen.getByText("2027학년도 수시모집"));
    expect(push).toHaveBeenCalledWith(`/dashboard/checklist/${sample.id}`);
  });

  it("periodStart/periodEnd 없으면 '- ~ -' 표시", () => {
    render(
      <RoundsList
        rounds={[{ ...sample, periodStart: null, periodEnd: null }]}
      />,
    );
    expect(screen.getByText("- ~ -")).toBeInTheDocument();
  });
});
