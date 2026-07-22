import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoundsList } from "../RoundsList";
import type { ChecklistRound } from "@/features/checklist/schemas";
import type { Completion } from "@/features/checklist/completion";

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
  completion,
};

describe("RoundsList", () => {
  it("빈 rounds → 안내문구", () => {
    render(<RoundsList rounds={[]} />);
    expect(screen.getByText(/회차가 없습니다/)).toBeInTheDocument();
  });

  it("회차 카드 렌더 — 제목 / 완료율 / 기간", () => {
    render(<RoundsList rounds={[sample]} />);
    expect(screen.getByText("2027학년도 수시모집")).toBeInTheDocument();
    expect(screen.getByText("5/10 · 50%")).toBeInTheDocument();
    expect(screen.getByText("2027-01-01 ~ 2027-01-31")).toBeInTheDocument();
  });

  it("카드 링크 → /dashboard/checklist/[id]", () => {
    render(<RoundsList rounds={[sample]} />);
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      `/dashboard/checklist/${sample.id}`,
    );
  });

  it("periodStart/periodEnd 없으면 '-' 표시", () => {
    render(
      <RoundsList
        rounds={[{ ...sample, periodStart: null, periodEnd: null }]}
      />,
    );
    expect(screen.getByText("- ~ -")).toBeInTheDocument();
  });
});
