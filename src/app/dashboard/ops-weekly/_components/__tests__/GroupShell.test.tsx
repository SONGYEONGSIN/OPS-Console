import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";

vi.mock("@/features/ops-weekly/actions", () => ({
  addManualItem: vi.fn(),
}));

import { GroupShell } from "../GroupShell";

afterEach(cleanup);

const add = { reportId: "r", area: "application" as const, groupKey: "dev" };

describe("GroupShell", () => {
  it("제목 옆에 건수, 오른쪽에 접힌 [+ 직접 추가]", () => {
    render(
      <GroupShell title="개발 중" count={3} add={add}>
        <p>본문</p>
      </GroupShell>,
    );
    expect(
      screen.getByRole("heading", { name: "개발 중" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3건")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "+ 직접 추가" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(button.className).toContain("ml-auto");
    expect(screen.queryByLabelText("직접 추가 제목")).toBeNull();
  });

  it("누르면 열리고 다시 누르면 접힌다", () => {
    render(
      <GroupShell title="개발 중" count={0} add={add}>
        <p>본문</p>
      </GroupShell>,
    );
    const button = screen.getByRole("button", { name: "+ 직접 추가" });
    fireEvent.click(button);
    expect(screen.getByLabelText("직접 추가 제목")).toBeInTheDocument();
    fireEvent.click(button);
    expect(screen.queryByLabelText("직접 추가 제목")).toBeNull();
  });

  it("add 가 없으면 버튼이 없다", () => {
    render(
      <GroupShell title="개발 중" count={0} add={null}>
        <p>본문</p>
      </GroupShell>,
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
