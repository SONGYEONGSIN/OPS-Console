import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import LoginPage from "../page";

let mockedParams: URLSearchParams;
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockedParams,
}));

describe("LoginPage", () => {
  beforeEach(() => {
    mockedParams = new URLSearchParams();
  });

  it("Suspense 통과 후 핵심 요소(Microsoft SSO 버튼) 렌더", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("button", { name: /Microsoft SSO로 계속/ })
    ).toBeInTheDocument();
  });

  it("로그인 화면은 상단 바(브랜드·시계)를 노출하지 않는다", () => {
    render(<LoginPage />);
    expect(screen.queryByText("운영부 상황실")).not.toBeInTheDocument();
    expect(screen.queryByText(/KST/)).not.toBeInTheDocument();
  });

  it("로그인 화면은 하단 연결정보(연결됨/서버)를 노출하지 않는다", () => {
    render(<LoginPage />);
    expect(screen.queryByText("연결됨")).not.toBeInTheDocument();
    expect(screen.queryByText("오프라인")).not.toBeInTheDocument();
  });

  it("기본 모드는 signin — '로그인' 탭 active", () => {
    render(<LoginPage />);
    // 탭 버튼이 DOM에서 첫 번째, SubmitButton이 두 번째 (둘 다 "로그인")
    const signinTab = screen.getAllByRole("button", { name: "로그인" })[0];
    expect(signinTab).toHaveAttribute("aria-current", "page");
  });

  it("errorParam=oauth_failed → Microsoft 인증 실패 alert 노출", () => {
    mockedParams = new URLSearchParams({ error: "oauth_failed" });
    render(<LoginPage />);
    expect(
      screen.getByRole("alert", { name: "" }) ||
        screen.getByText(/Microsoft 인증에 실패했습니다/)
    ).toBeInTheDocument();
  });

  it("errorParam=missing_code → 인증 응답 오류 alert", () => {
    mockedParams = new URLSearchParams({ error: "missing_code" });
    render(<LoginPage />);
    expect(screen.getByText(/인증 응답에 오류가 있습니다/)).toBeInTheDocument();
  });

  it("errorParam=exchange_failed → 세션 발급 실패 alert", () => {
    mockedParams = new URLSearchParams({ error: "exchange_failed" });
    render(<LoginPage />);
    expect(screen.getByText(/세션 발급에 실패했습니다/)).toBeInTheDocument();
  });
});
