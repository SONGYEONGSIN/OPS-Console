import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

let mockedParams: URLSearchParams;
vi.mock("next/navigation", () => ({
  useSearchParams: () => mockedParams,
}));
vi.mock("@/components/auth/AuthShell", () => ({
  AuthShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/features/auth/actions", () => ({
  forgotPassword: vi.fn(),
}));

import ForgotPasswordPage from "../page";

describe("ForgotPasswordPage callback error display", () => {
  beforeEach(() => {
    mockedParams = new URLSearchParams();
  });

  it("error=link_expired → 만료 메시지", () => {
    mockedParams = new URLSearchParams({ error: "link_expired" });
    render(<ForgotPasswordPage />);
    expect(
      screen.getByText("재설정 링크가 만료되었습니다. 다시 요청해주세요."),
    ).toBeInTheDocument();
  });

  it("error=link_invalid → 무효/사용됨 메시지", () => {
    mockedParams = new URLSearchParams({ error: "link_invalid" });
    render(<ForgotPasswordPage />);
    expect(
      screen.getByText(
        "재설정 링크가 유효하지 않거나 이미 사용되었습니다. 다시 요청해주세요.",
      ),
    ).toBeInTheDocument();
  });

  it("error 파라미터 없으면 callback error 미노출", () => {
    render(<ForgotPasswordPage />);
    expect(screen.queryByText(/재설정 링크가/)).not.toBeInTheDocument();
  });
});
