import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChromeUser } from "../ChromeUser";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe("ChromeUser", () => {
  it("OPERATORS 매칭 사용자 — 풀네임 + 팀·직급", () => {
    render(
      <ChromeUser
        displayName="송영신"
        email="ys1114@jinhakapply.com"
        role="팀장"
        team="운영2팀"
      />,
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });

  it("fallback(비-OPERATORS) — email username + 관리자", () => {
    render(
      <ChromeUser
        displayName="ysong2526"
        email="ysong2526@gmail.com"
        role="관리자"
        team={null}
      />,
    );
    expect(screen.getByText("ysong2526")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });

  it("dropdown 열면 이메일 노출", () => {
    render(
      <ChromeUser
        displayName="송영신"
        email="ys1114@jinhakapply.com"
        role="팀장"
        team="운영2팀"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(
      screen.getByText("ys1114@jinhakapply.com"),
    ).toBeInTheDocument();
  });

  it("admin이면 '시스템 설정' 노출, 아니면 미노출", () => {
    const { rerender } = render(
      <ChromeUser
        displayName="송영신"
        email="a@x.com"
        role="팀장"
        team="운영2팀"
        permission="admin"
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByText("시스템 설정")).toBeInTheDocument();

    rerender(
      <ChromeUser
        displayName="김슬기"
        email="b@x.com"
        role="매니저"
        team="운영1팀"
        permission="member"
      />,
    );
    expect(screen.queryByText("시스템 설정")).toBeNull();
  });
});
