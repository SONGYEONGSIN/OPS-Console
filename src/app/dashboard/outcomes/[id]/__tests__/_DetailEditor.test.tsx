import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/performance/actions", () => ({
  createGoal: vi.fn(async () => ({ ok: true })),
  createMetric: vi.fn(async () => ({ ok: true })),
  submitMetrics: vi.fn(async () => ({ ok: true })),
  upsertRubric: vi.fn(async () => ({ ok: true })),
  publishReport: vi.fn(async () => ({ ok: true })),
  previewMetricQuant: vi.fn(async () => null),
}));

import { OutcomeDetailEditor } from "../_DetailEditor";

const baseProps = {
  assignmentId: "a1",
  currentStep: 3 as const,
  goals: [{ id: "g1", title: "목표A", body: null }],
  metrics: [
    { id: "m1", name: "지표A", weight: 40, achievement: 100, sourceKey: null, quant: null },
    { id: "m2", name: "지표B", weight: 40, achievement: 50, sourceKey: null, quant: null },
  ],
  rubric: [
    { id: "r1", criterion: "태도·문화", score: 5, comment: null },
    { id: "r2", criterion: "협업", score: 5, comment: null },
    { id: "r3", criterion: "문제해결", score: 5, comment: null },
  ],
};

describe("OutcomeDetailEditor", () => {
  it("3섹션 + 종합 렌더", () => {
    render(<OutcomeDetailEditor {...baseProps} />);
    expect(screen.getByText("개인목표")).toBeInTheDocument();
    expect(screen.getByText("성과지표 (80%)")).toBeInTheDocument();
    expect(screen.getByText("관리자지표 (20%)")).toBeInTheDocument();
    expect(screen.getByText("종합")).toBeInTheDocument();
  });

  it("가중치 합 배지 = 80/80", () => {
    render(<OutcomeDetailEditor {...baseProps} />);
    expect(screen.getByText(/가중치 합 80\/80/)).toBeInTheDocument();
  });

  it("종합점수 80 + 등급 A (성과60 + 관리20)", () => {
    render(<OutcomeDetailEditor {...baseProps} />);
    expect(screen.getByText("80")).toBeInTheDocument();
    expect(screen.getByText("A")).toBeInTheDocument();
  });
});
