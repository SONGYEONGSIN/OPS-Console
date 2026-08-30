import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const { upsertSpy, result } = vi.hoisted(() => ({
  upsertSpy: vi.fn(),
  result: { value: { ok: true, id: "g1" } as unknown },
}));

vi.mock("@/features/performance/org-goal-actions", () => ({
  upsertOrgGoal: (input: unknown) => {
    upsertSpy(input);
    return Promise.resolve(result.value);
  },
  deleteOrgGoal: () => Promise.resolve({ ok: true }),
}));

const { OrgGoalsSection } = await import("../OrgGoalsSection");

const goal = {
  id: "g1",
  scope: "team" as const,
  owner_name: "운영1팀",
  period_start: "2026-03-01",
  period_end: "2027-02-28",
  title: "마감 완수 300건",
  target_value: 300,
  unit: "건",
  source_key: "closing-completed",
  lower_is_better: false,
  note: null,
  actual: 150,
  memberCount: 8,
  achievement: 50,
};

/**
 * 조직 목표는 등록만 하면 아무도 안 보는 표가 된다 — 목표 옆에 **실적과
 * 달성률**이 같이 보여야 쓰인다.
 */
describe("OrgGoalsSection", () => {
  beforeEach(() => {
    upsertSpy.mockClear();
    result.value = { ok: true, id: "g1" };
  });

  it("등록된 목표를 조직·목표·실적으로 보여준다", () => {
    render(<OrgGoalsSection goals={[goal]} />);
    expect(screen.getByText("운영1팀")).toBeInTheDocument();
    expect(screen.getByText("마감 완수 300건")).toBeInTheDocument();
    expect(screen.getByText("150건")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  /** 0 은 '한 건도 못 했다'로 읽힌다 — 실제로는 '셀 방법이 없다'이다. */
  it("집계 소스가 없으면 실적을 0 이 아니라 '—' 로 둔다", () => {
    render(
      <OrgGoalsSection
        goals={[{ ...goal, source_key: null, actual: null, achievement: null }]}
      />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  /** 조직 이름이 조직도와 안 맞으면 합산 대상이 0 명이라 실적이 영영 0 이다. */
  it("소속원이 0 명이면 그렇다고 알린다", () => {
    render(<OrgGoalsSection goals={[{ ...goal, memberCount: 0 }]} />);
    expect(screen.getByText(/소속원이 없습니다/)).toBeInTheDocument();
  });

  it("한 건도 없으면 비어 있다고 말한다", () => {
    render(<OrgGoalsSection goals={[]} />);
    expect(screen.getByText(/등록된 조직 목표가 없습니다/)).toBeInTheDocument();
  });

  it("열기 전에는 저장하지 않는다", () => {
    render(<OrgGoalsSection goals={[]} />);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it("버튼을 누르면 등록 폼이 열린다", () => {
    render(<OrgGoalsSection goals={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /조직 목표/ }));
    expect(screen.getByLabelText(/목표 제목/)).toBeInTheDocument();
  });

  it("저장 실패하면 사유를 그대로 보여준다", async () => {
    result.value = { ok: false, error: "admin만 등록할 수 있습니다" };
    render(<OrgGoalsSection goals={[]} />);
    fireEvent.click(screen.getByRole("button", { name: /조직 목표/ }));
    fireEvent.change(screen.getByLabelText(/목표 제목/), {
      target: { value: "테스트 목표" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(
      await screen.findByText(/admin만 등록할 수 있습니다/),
    ).toBeInTheDocument();
  });
});
