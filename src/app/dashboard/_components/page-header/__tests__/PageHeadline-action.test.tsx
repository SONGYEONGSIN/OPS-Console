import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PageHeadline } from "../PageHeadline";

/**
 * 제목 오른쪽 액션 자리 — 원본 파일로 가는 버튼을 여기에 둔다(2026-09-07 요청).
 *
 * 목록 헤더(`ListPattern`)에는 그 자리가 있는데 `PageHeader` 를 직접 쓰는
 * 페이지에는 없었다. 총괄장이 그런 페이지다.
 */
describe("PageHeadline — 액션 자리", () => {
  it("주면 제목 옆에 그린다", () => {
    render(
      <PageHeadline title="총괄장" accent="서비스사이클" action={<a href="/x">총괄장</a>} />,
    );
    expect(screen.getByRole("link", { name: "총괄장" })).toBeInTheDocument();
  });

  it("안 주면 아무것도 안 그린다 — 빈 자리가 여백을 먹지 않는다", () => {
    const { container } = render(<PageHeadline title="총괄장" />);
    expect(container.querySelector("[data-headline-action]")).toBeNull();
  });

  it("제목과 한 줄에 놓이고 오른쪽으로 밀린다", () => {
    const { container } = render(
      <PageHeadline title="총괄장" action={<a href="/x">총괄장</a>} />,
    );
    const row = container.querySelector("[data-headline-row]");
    expect(row, "제목 줄을 못 찾았습니다").toBeTruthy();
    expect(row!.className).toContain("justify-between");
  });

  it("설명은 그대로 제목 아래 — 액션이 껴들지 않는다", () => {
    render(
      <PageHeadline title="총괄장" description="대학별 배정을 조회합니다." action={<a href="/x">총괄장</a>} />,
    );
    expect(screen.getByText("대학별 배정을 조회합니다.")).toBeInTheDocument();
  });
});
