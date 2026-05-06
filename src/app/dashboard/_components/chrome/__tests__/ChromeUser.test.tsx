import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChromeUser } from "../ChromeUser";

describe("ChromeUser", () => {
  it("OPERATORS 매칭 사용자 — 풀네임 + 팀·직급", () => {
    render(
      <ChromeUser
        displayName="송영신"
        role="팀장"
        team="운영2팀"
      />
    );
    expect(screen.getByText("송영신")).toBeInTheDocument();
    expect(screen.getByText("운영2팀 · 팀장")).toBeInTheDocument();
  });

  it("fallback(비-OPERATORS) — email username + 관리자", () => {
    render(
      <ChromeUser
        displayName="ysong2526"
        role="관리자"
        team={null}
      />
    );
    expect(screen.getByText("ysong2526")).toBeInTheDocument();
    expect(screen.getByText("관리자")).toBeInTheDocument();
  });
});
