import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { UnmatchedNotice } from "../UnmatchedNotice";

afterEach(cleanup);

const base = {
  noun: "서비스",
  action: "서비스 마감 메뉴에서 담당자 이름을 확인하세요",
  settingsHref: "/dashboard/ops-weekly?week=2026-11-16&tab=settings#unmatched",
};

describe("UnmatchedNotice", () => {
  it("비관리자에게는 아무것도 그리지 않는다", () => {
    const { container } = render(
      <UnmatchedNotice {...base} isAdmin={false} count={5} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("관리자 0건: 문구만, 조치·링크 없음", () => {
    render(<UnmatchedNotice {...base} isAdmin count={0} />);
    expect(
      screen.getByText("담당자가 맞지 않아 아무에게도 안 붙은 서비스 0건"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("관리자 n건: 조치 문구 + 설정 패널 링크, 문구는 한 텍스트 노드", () => {
    render(<UnmatchedNotice {...base} noun="발표 서비스" isAdmin count={2} />);
    expect(
      screen.getByText(
        "담당자가 맞지 않아 아무에게도 안 붙은 발표 서비스 2건 — 서비스 마감 메뉴에서 담당자 이름을 확인하세요",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "관리에서 목록 보기" }),
    ).toHaveAttribute("href", base.settingsHref);
  });
});
