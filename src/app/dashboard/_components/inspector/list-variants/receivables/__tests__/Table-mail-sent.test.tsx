import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ListRow } from "../../../../patterns/ListPattern";
import { ReceivablesTable } from "../Table";

const row = (mailSentDate?: string): ListRow => ({
  id: "r-0",
  name: "한양대학교",
  status: "active",
  owner: "송영신",
  receivablesCells: {
    headers: [],
    textValues: [],
    schoolOwner: "a@b.kr",
    mailSentDate,
  },
});

function renderTable(rows: ListRow[]) {
  return render(
    <ReceivablesTable rows={rows} selectedId={null} onSelect={vi.fn()} />,
  );
}

describe("ReceivablesTable — 독려메일 발송일자 열", () => {
  it("머리글이 학교 담당자 이메일 바로 다음이다", () => {
    renderTable([row("2026-10-01")]);
    const heads = screen
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    const i = heads.indexOf("학교 담당자 이메일");
    expect(i).toBeGreaterThanOrEqual(0);
    expect(heads[i + 1]).toBe("독려메일 발송일자");
  });

  it("값을 렌더하고 tabular-nums 이며 font-mono 가 아니다", () => {
    renderTable([row("2026-10-01")]);
    const cell = screen.getByText("2026-10-01");
    expect(cell.className).toContain("tabular-nums");
    expect(cell.className).not.toContain("font-mono");
  });

  it("빈 값은 - 로 보인다", () => {
    renderTable([row("")]);
    const cells = screen.getAllByRole("cell");
    const heads = screen.getAllByRole("columnheader").map((h) => h.textContent);
    expect(cells[heads.indexOf("독려메일 발송일자")].textContent).toBe("-");
  });

  it("빈 표 colSpan 은 9 이다", () => {
    renderTable([]);
    expect(screen.getByText("데이터 없음").getAttribute("colspan")).toBe("9");
  });
});
