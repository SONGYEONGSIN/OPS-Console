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

/**
 * "목표 기반" — 지금까지 달성률은 사람이 손으로 넣는 값이었다. 목표를 등록하면
 * 실적/목표로 저절로 나온다.
 */
describe("OutcomeDetailEditor — 목표 기반 달성률", () => {
  const withTarget = {
    ...baseProps,
    metrics: [
      {
        id: "m1",
        name: "지표A",
        weight: 40,
        achievement: 10,
        sourceKey: "ai-work-hours",
        quant: { value: 15, unit: "시간" },
        effective: { value: 75, source: "auto" as const },
        target: 20,
        unit: "시간",
      },
      {
        id: "m2",
        name: "지표B",
        weight: 40,
        achievement: 50,
        sourceKey: null,
        quant: null,
        effective: { value: 50, source: "manual" as const },
        target: null,
        unit: null,
      },
    ],
  };

  it("목표가 있으면 실적/목표를 함께 보여준다", () => {
    render(<OutcomeDetailEditor {...withTarget} />);
    expect(screen.getByText(/15\s*\/\s*20시간/)).toBeInTheDocument();
  });

  /**
   * 계산값이 손입력을 덮는다. 손입력 10 이 남아 있어도 화면은 75 여야 한다 —
   * 아니면 화면과 실제가 갈린다.
   */
  it("계산된 달성률을 쓴다 — 손입력을 덮는다", () => {
    render(<OutcomeDetailEditor {...withTarget} />);
    expect(screen.getByText(/달성률 75%/)).toBeInTheDocument();
    expect(screen.queryByText(/달성률 10%/)).not.toBeInTheDocument();
  });

  it("자동인지 손입력인지 밝힌다 — 숫자만 보면 어디서 왔는지 모른다", () => {
    render(<OutcomeDetailEditor {...withTarget} />);
    expect(screen.getByText(/자동/)).toBeInTheDocument();
    expect(screen.getByText(/직접 입력/)).toBeInTheDocument();
  });

  it("점수도 계산된 달성률로 낸다", () => {
    render(<OutcomeDetailEditor {...withTarget} />);
    // 40 × 75% = 30점
    expect(screen.getByText("30점")).toBeInTheDocument();
  });
});
