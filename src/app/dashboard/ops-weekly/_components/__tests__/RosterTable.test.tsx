import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import { RosterTable } from "../RosterTable";

afterEach(cleanup);

const rows = [
  { email: "a@x", name: "운영자A", team: "운영1팀" },
  { email: "out@y", name: null, team: null },
];

describe("RosterTable", () => {
  it("팀·이름·이메일 칸과 행 끝 칸 — 이름이 없으면 이메일, 팀이 없으면 —", () => {
    render(
      <RosterTable
        label="후보"
        rows={rows}
        action={{
          header: "작업",
          cell: (r) => <button>{`${r.email} 버튼`}</button>,
        }}
      />,
    );
    const table = screen.getByRole("table", { name: "후보" });
    const headers = within(table)
      .getAllByRole("columnheader")
      .map((h) => h.textContent);
    expect(headers).toEqual(["팀", "이름", "이메일", "작업"]);
    const out = within(table).getAllByRole("row")[2];
    expect(within(out).getAllByText("out@y")).toHaveLength(1);
    expect(within(out).getByText("—")).toBeInTheDocument();
    expect(
      within(out).getByRole("button", { name: "out@y 버튼" }),
    ).toBeInTheDocument();
  });

  it("lead 칸이 있으면 맨 앞에 붙는다", () => {
    render(
      <RosterTable
        label="순번"
        rows={rows.slice(0, 1)}
        lead={{ header: "순번", cell: () => "1" }}
        action={{ header: "작업", cell: () => null }}
      />,
    );
    expect(screen.getAllByRole("columnheader")[0]).toHaveTextContent("순번");
    expect(screen.getAllByRole("cell")[0]).toHaveTextContent("1");
  });

  it("빈 명단은 안내 한 줄", () => {
    render(
      <RosterTable
        label="빈"
        rows={[]}
        emptyText="명단이 비어 있습니다"
        action={{ header: "작업", cell: () => null }}
      />,
    );
    expect(screen.getByText("명단이 비어 있습니다")).toBeInTheDocument();
  });
});
