import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { WorklogView } from "../View";
import type { ListRow } from "../../../../patterns/ListPattern";

function makeRow(over: Partial<ListRow> = {}): ListRow {
  return {
    id: "w1",
    name: "계약 승인 처리",
    status: "active",
    owner: "송영신",
    worklogLevel: "INFO",
    worklogDomain: "contracts",
    worklogAction: "approve",
    worklogTarget: "한양대학교",
    worklogTs: "2026-05-20T14:23:00Z",
    worklogUser: "송영신",
    ...over,
  };
}

describe("WorklogView", () => {
  it("메시지 / 레벨 / 사용자 / 도메인 노출", () => {
    render(<WorklogView row={makeRow()} />);
    expect(screen.getByText("계약 승인 처리")).toBeInTheDocument();
    expect(screen.getByText("INFO")).toBeInTheDocument();
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("contracts")).toBeInTheDocument();
  });

  it("ERROR 레벨 — vermilion 강조", () => {
    render(<WorklogView row={makeRow({ worklogLevel: "ERROR" })} />);
    const badge = screen.getByText("ERROR");
    expect(badge.className).toMatch(/vermilion/);
  });

  it("대상(target) 있으면 노출", () => {
    render(<WorklogView row={makeRow()} />);
    expect(screen.getByText(/한양대학교/)).toBeInTheDocument();
  });
});
