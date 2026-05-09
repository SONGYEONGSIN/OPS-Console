import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase client
const mockExchange = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { exchangeCodeForSession: mockExchange },
  })),
}));

import { GET } from "../route";

describe("/auth/callback recovery branch", () => {
  beforeEach(() => {
    mockExchange.mockReset();
  });

  it("recovery + otp_expired → /forgot-password?error=link_expired", async () => {
    const url =
      "http://localhost:3000/auth/callback?next=/reset-password&error=access_denied&error_code=otp_expired";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=link_expired",
    );
  });

  it("recovery + 기타 error → /forgot-password?error=link_invalid", async () => {
    const url =
      "http://localhost:3000/auth/callback?next=/reset-password&error=access_denied&error_code=invalid_token";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=link_invalid",
    );
  });

  it("recovery + code 없음 → /forgot-password?error=link_invalid", async () => {
    const url = "http://localhost:3000/auth/callback?next=/reset-password";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=link_invalid",
    );
  });

  it("OAuth(non-recovery) + error → /login?error=oauth_failed (기존 동작 유지)", async () => {
    const url =
      "http://localhost:3000/auth/callback?error=access_denied&error_code=invalid_state";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/login?error=oauth_failed",
    );
  });

  it("recovery + code 정상 → /reset-password", async () => {
    mockExchange.mockResolvedValue({ error: null });
    const url =
      "http://localhost:3000/auth/callback?next=/reset-password&code=pkce_xxx";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/reset-password",
    );
  });

  it("recovery + exchange 실패 → /forgot-password?error=link_invalid", async () => {
    mockExchange.mockResolvedValue({ error: { message: "bad code" } });
    const url =
      "http://localhost:3000/auth/callback?next=/reset-password&code=pkce_bad";
    const req = new Request(url);
    const res = await GET(req as never);
    expect(res.headers.get("location")).toBe(
      "http://localhost:3000/forgot-password?error=link_invalid",
    );
  });
});
