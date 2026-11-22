import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";

import { GroupShell } from "../GroupShell";

afterEach(cleanup);

describe("GroupShell", () => {
  it("제목 옆에 건수, 본문을 그대로 그린다", () => {
    render(
      <GroupShell title="개발 중" count={3}>
        <p>본문</p>
      </GroupShell>,
    );
    expect(
      screen.getByRole("heading", { name: "개발 중" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3건")).toBeInTheDocument();
    expect(screen.getByText("본문")).toBeInTheDocument();
  });

  it("[+ 직접 추가] 버튼이 없다 — 직접 추가는 쓸 것 패널 한 곳", () => {
    render(
      <GroupShell title="개발 중" count={0}>
        <p>본문</p>
      </GroupShell>,
    );
    expect(screen.queryByRole("button", { name: "+ 직접 추가" })).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByLabelText("직접 추가 제목")).toBeNull();
  });

  it("headingHidden — 하위 탭이 이미 이름·건수를 보여 줄 때 제목 줄은 화면에서 숨고(sr-only) 이름은 남는다", () => {
    render(
      <GroupShell title="운영 중" count={192} headingHidden>
        <p>본문</p>
      </GroupShell>,
    );
    const h = screen.getByRole("heading", { name: "운영 중" });
    expect((h.parentElement as HTMLElement).className.split(/\s+/)).toContain(
      "sr-only",
    );
  });
});
