import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { BADGE_TONE } from "../../badge-tone";
import { ReceivablesTable } from "../Table";

const baseRow: ListRow = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "2026학년도 수시 원서접수",
  status: "active",
  owner: "송영신",
};

describe("ReceivablesTable — 입금여부 배지 톤", () => {
  it("미수는 주의 톤이다", () => {
    render(
      <ReceivablesTable
        rows={[{ ...baseRow, status: "active" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("미수").className).toContain(BADGE_TONE.attention);
  });

  it("수금은 완료 톤이다", () => {
    render(
      <ReceivablesTable
        rows={[{ ...baseRow, status: "approved" }]}
        selectedId={null}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByText("수금").className).toContain(BADGE_TONE.done);
  });
});
