import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse, NextRequest } from "next/server";

const updateSession = vi.fn();
vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: (...a: unknown[]) => updateSession(...a),
}));

import { proxy } from "./proxy";

function reqFor(path: string) {
  return new NextRequest(`http://localhost${path}`);
}

describe("proxy 미들웨어", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateSession.mockResolvedValue({
      supabaseResponse: NextResponse.next(),
      user: null,
    });
  });

  it("미인증 + 비공개 경로(/dashboard) → /login 리다이렉트", async () => {
    const res = await proxy(reqFor("/dashboard"));
    expect(res.headers.get("location")).toContain("/login");
  });

  it("미인증 + dispatch 라우트는 public → 리다이렉트 안 함", async () => {
    const res = await proxy(reqFor("/api/data-requests/dispatch"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("미인증 + automations/run(cron 진입점)은 public → 리다이렉트 안 함", async () => {
    const res = await proxy(
      reqFor("/api/automations/run?jobId=receivables-deposit-match"),
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("미인증 + closing/ingest(스크래퍼 적재)은 public → 리다이렉트 안 함", async () => {
    const res = await proxy(reqFor("/api/closing/ingest"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("미인증 + closing/run-log(스크래퍼 결과 보고)은 public → 리다이렉트 안 함", async () => {
    const res = await proxy(reqFor("/api/closing/run-log"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("로그인 상태 + /login → /dashboard 리다이렉트", async () => {
    updateSession.mockResolvedValue({
      supabaseResponse: NextResponse.next(),
      user: { id: "u1" },
    });
    const res = await proxy(reqFor("/login"));
    expect(res.headers.get("location")).toContain("/dashboard");
  });
});
