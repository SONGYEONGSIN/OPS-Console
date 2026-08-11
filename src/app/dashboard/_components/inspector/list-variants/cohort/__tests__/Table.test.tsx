import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";
import { CohortTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "2026년 1기",
  status: "active",
  owner: "송영신",
};

function toneOf(label: string): string {
  const el = screen.getByText(label);
  return el.className;
}

describe("CohortTable — 기수 상태 배지 톤", () => {
  it("진행중은 progress 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "in_progress" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("진행중")).toContain(BADGE_TONE.progress);
  });

  it("완료는 done 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "completed" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("완료")).toContain(BADGE_TONE.done);
  });

  it("계획은 idle 톤이다", () => {
    render(
      <CohortTable
        rows={[{ ...baseRow, cohortStatus: "planned" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(toneOf("계획")).toContain(BADGE_TONE.idle);
  });
});
